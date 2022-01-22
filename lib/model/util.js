const {
  format: fmt,
} = require('util');

const {
  capitalCase,
  snakeCase,
  pascalCase,
} = require('change-case');

const pluralize = require('pluralize');

const {
  collection: {
    arrayIntersect,
    getIfSet,
    hasKey,
    lookupMap,
    peak,
    subObject,
    uniqueArray,
  },
  logic: {
    and,
    andArr,
    or,
  },
  type: {
    isArray,
    isNotArray,
    isObject,
    isString,
    isNotString,
    isNull,
    isFunction,
    isNotObject,
    isNotUndefined,
  },
  string: {
    split,
  },
  rand: {
    randStr,
  },
} = require('../util');

const _makeKeys = (key) => isArray(key) ? key : [key];

/*
 * Any interface will use the aliases, but knex does not do the work
 * for us. For instance, if there is a join on two tables with 'id'
 * as a column, even if the 'joins' and 'selectColumns' arrays boil
 * down into knex commands, unless we use `where({'otherTable.id': 12})`
 * postgres will throw an error. This creates a reverse lookup based on
 * selectArgs
 */
const _makeAliasLookup = (selectArgs = []) => {
  return selectArgs.reduce((obj, clause) => {
    const [relation, rest] = clause.split('.')
    const [column, alias] = rest.split(' AS ');
    return {
      ...obj,
      [alias]: { entityName: relation, column }
    }
  }, {});
};

/*
 * Using the aliased, selected columns name, do a reverse lookup
 * to get the original table and column name:
 * e.g.
 * select foo.bar as fooBar
 * _resolveAlias('fooBar', lookup) will return 'foo.bar'
 */
const _resolveAlias = (alias, aliasLookup, primaryTable) => {
  const info = getIfSet(aliasLookup, alias, {});
  const relation = getIfSet(info, 'entityName', primaryTable);
  const column = getIfSet(info, 'column', alias);
  return `${relation}.${column}`;
};

const _makeWhere  = (where = {}, aliasLookup = {}, primaryTable) => {
  const nextWhere = {};
  for (const alias in where) {
    const actual = _resolveAlias(alias, aliasLookup, primaryTable);
    nextWhere[actual] = where[alias];
  }
  return nextWhere;
}



/*
 * Creates SQL column selectors, for example:
 * _makeSelectArgs([
 *   'id',
 *   ['name', 'personName'],
 * ],
 * 'person'),
 * produces:
 * person.id AS id
 * person.name AS personName
 * You can also nest arrays and it will all be flattened:
 * _makeSelectArgs([
 *   [
 *     'person', [
 *       'id'
 *     ],
 *   ],
 *   [
 *     'taco', [
 *       ['id', 'tacoId'],
 *     ]
 *   ],
 * ])
 * becomes a flat array with:
 * person.id AS id
 * taco.id AS tacoId
 */
const _makeSelectArgs = (selectColumns, entityName) => {
  return selectColumns.map((col) => {
    if(isArray(col)) {
      if (and(col.length === 2, isArray(col[1]), isString(col[0]))) {
        return _makeSelectArgs(col[1], col[0]);
      }
      if (andArr([col[0], col[1]].map(isString))) {
        return `${entityName}.${col[0]} AS ${col[1]}`
      }
    }
    return `${entityName}.${col} AS ${col}`
  }).flat();
}


/*
 * joins property must be an array of arrays such as:
 * [
 *   ['innerJoin', 'foo', 'foo.barId', 'bar.id'],
 *   ['leftJoin', 'bar', 'baz.createdAt', '>', 'foo.createdAt'],
 * ]
 * Each row is a 1 to 1 mapping for knexs join methods including
 * the method name as the first element.
 */
const _validJoins = [
  'innerJoin',
  'leftJoin',
  'rightJoin',
  'join',
  'joinRaw',
];

const _joinsAreValid = (joins) => {
  if (isNotArray(joins) || joins.length === 0) {
    return false;
  }
  for (const join of joins) {
    if (isNotArray(join)) {
      throw new TypeError('Getter joins must be array of arrays');
    }
    for (let i = 0; i < join.length; i++) {
      const elem = join[i];
      if (i !== 1 && isNotString(elem)) {
        throw new TypeError('Join element must be strings');
      } else if (i == 1 && isNotString(elem) && isNotObject(elem)) {
        throw new TypeError('Join table must be a string or object');
      }
    }
    if (!_validJoins.includes(join[0])) {
      throw new Error('Join type must be one of ' + list(_validJoins));
    }
  }
  return true;
}


/*
 * Get the joined tables from join metadata as map of [table] : true
 */

const _getJoinTables = (joins = []) => joins.map(([type, table]) => {
  if (type === 'joinRaw') {
    const match = /join (.*?)(?: as (.*))? on/i.exec(table);
    return match ? match[2] || match[1] : table;
  }
  return isObject(table)
    ? Object.keys(table).pop()
    : table;
});

const _getJoinTableMap = (joins = []) => lookupMap(_getJoinTables(joins));
const _getJoinCallsInOrder = (joins = []) => joins.map(([joinType]) => joinType);
const _getJoinCallsUnique = (joins = []) => uniqueArray(_getJoinCallsInOrder(joins));

/*
 * Filter columns based on what is being joined. Otherwise you can
 * get a column does not exist error where no join is done.
 */
const _getSelectColumnTables = (cols = [], joinMap = {}, entityName) => {
  return cols.filter((col) => {
    const [table] = col.split('.');
    return or(entityName === table, hasKey(joinMap, table))
  });
}

const _switchKnexJoin = (knexJoinType) => {
  switch (knexJoinType) {
    case 'rightJoin': return 'RIGHT JOIN';
    case 'leftJoin': return 'LEFT JOIN';
    case 'outerJoin': return 'OUTER JOIN';
    case 'innerJoin': return 'INNER JOIN';
    case 'join':
    default: return 'JOIN';
  }
}
/**
 * Schemas are a useful part of postgres, but knexjs doesn't have great
 * support for cross schema joins! The work-around is to use joinRaw
 * but this is cludgy from calling code: This takes an ordinary join
 * (like leftJoin, innerJoin) and detects if joins are done outside of
 * the schema. If they are, a new joinRaw replaces the regular join
 * e.g.
 * ['leftJoin', 'access.person AS person', 'person.id', 'account.personId']
 * becomes:
 * ['joinRaw', 'LEFT JOIN access.person AS person ON person.id = account.personId']
 */
const _preprocessJoins = (joins = []) => {

  if (joins.length === 0) return [];

  return joins.map((join) => {
    let [type, ...joinArgs] = join;
    // leave joinRaw alone
    if (type === 'joinRaw') {
      return join;
    }

    const joinedTable = joinArgs[0];

    const match = /^(\w+)\.(\w+)(?: as (\w+))?$/i.exec(joinedTable);

    if (!match) {
      return join;
    }

    const joinTypeSql = _switchKnexJoin(type);

    let [, schema, source, alias] = match;

    schema = schema && snakeCase(schema);
    source = source && snakeCase(source);
    alias = alias && snakeCase(alias);

    joinArgs = joinArgs.map((ident)  => ident.split('.').map(snakeCase).join('.'));

    // just table names with equality operator
    if (joinArgs.length === 3) {

      return alias
        ? ['joinRaw', `${joinTypeSql} ${schema}.${source} AS ${alias} ON ${joinArgs[1]} = ${joinArgs[2]}`]
        : ['joinRaw', `${joinTypeSql} ${schema}.${source} ON ${joinArgs[1]} = ${joinArgs[2]}`];

    // includes operator ('<', '=', '>')
    } else if (joinArgs.length === 3) {

      return alias
        ? ['joinRaw', `${joinTypeSql} ${schema}.${source} AS ${alias} ON ${joinArgs[1]} ${joinArgs[2]} ${joinArgs[3]}`]
        : ['joinRaw', `${joinTypeSql} ${schema}.${source} ON ${joinArgs[1]} ${joinArgs[2]} ${joinArgs[3]}`];

    }
  });
}

const _select = (db, selectArgs, entityName, joins, useJoins, whereFn) => {

  // TODO: for performance possibly hoist the joinMap up into either
  // - modelFromContext
  // - each action when it is created
  const joinMap = _getJoinTableMap(joins);

  const nextSelectArgs = _getSelectColumnTables(selectArgs, joinMap, entityName);

  let query = db.select(nextSelectArgs)
    .from(entityName)
    .where(whereFn);

  if (useJoins) {
    for ( const [joinType, table, ...joinRest] of joins) {
      query = query[joinType](table, ...joinRest);
    }
  }

  return query;

}

const _applyBulkWhere = (builder, records, keys, aliases, db, logger, negate = false) => {

  logger.debug('records for bulk where: %o', records);

  const whereValues = records.map((row) => {
    return keys.length === 1
      ? getIfSet(row, peak(keys))
      : subObject(row, keys)
  })
  .filter(isNotUndefined);

  logger.debug('bulk where values %s', whereValues);

  // allow complimentary bulk lookup
  if (negate === true) {
    if (keys.length === 1) {
      logger.debug('negating one key. simple wherein being used on %s', peak(keys));
      const actualColumn = _resolveAlias(peak(keys), aliases);
      builder.whereNotIn(actualColumn, whereValues);
    } else {
      logger.debug('negating multiple keys, using ORs & ANDs');
      whereValues.forEach((whereRow) => {
        builder.orWhereNot(_makeWhere(whereRow, aliases));
      });
    }
    return;
  }

  if (keys.length === 1) {
    logger.debug('one key. simple wherein being used on %s', peak(keys));
    const actualColumn = _resolveAlias(peak(keys), aliases);
    builder.whereIn(actualColumn, whereValues);
  } else {
    logger.debug('multiple keys, using ORs & ANDs');
    whereValues.forEach((whereRow) => {
      builder.orWhere(_makeWhere(whereRow, aliases));
    });
  }
}

// TODO: evaluate benefit of using 1 year previous of data by default.
// this would (in the case of created_at column) use the brin index
// which could be helpful down the road as a default for improving speed.
//
// This assumes a controller upstream has validated these fields
// as valid timestamp before handing off to the model. Also, this is
// not prefixed with underscore as it is intended to be used within
// onBuildListWhere hook.
const applyDateRange = (alias, name, builder, args, defaultStart = null, defaultEnd = null) => {
  if (hasKey(args, `${name}Start`)) {
    builder.where(alias, '>=', args[`${name}Start`]);
  } else if (!isNull(defaultStart))  {
    builder.where(alias, '>=', defaultStart);
  }
  if (hasKey(args, `${name}End`)) {
    builder.where(alias, '<=', args[`${name}End`]);
  } else if (!isNull(defaultEnd))  {
    builder.where(alias, '<=', defaultEnd);
  }
}

/*
 * Map a PG style data type descriptor to a JS type
 */
const _mapInternalSchemaType = (type) => {
  switch (type) {
    case 'character':
    case 'text':
    case 'character varying':
      return 'string';
    case 'bigint':
    case 'integer':
    case 'serial':
    case 'smallint':
    case 'smallserial':
      return 'int';
    case 'double precision':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'timestamp without time zone':
    case 'timestamp with time zone':
      return 'date';
  }
};

const _makeProfileId = (args, fnName, pascalEntity) => {
  return `${getIfSet(args,'_uniqueRequestId', randStr(16))} ${fnName}${pascalEntity} time`;
};

const makeWhereBuilder = ( config = {}) => {

  const {
    like = [],
    equals = [],
    oneOf = [],
    dateRange = [],
    entityName,
  } = config;

  return (builder, args, aliasLookup) => {
    like.forEach((name) => {
      let value;
      if (isArray(name)) {
        let [column, alias] = name;
        value = getIfSet(args, alias);
        if (isNotUndefined(value)) {
          column = _resolveAlias(column, aliasLookup, entityName);
          builder.where(column, 'like', `${value}%`);
        }
      } else if (isNotUndefined(value = getIfSet(args, name))) {
        const column = _resolveAlias(name, aliasLookup, entityName);
        builder.where(column, 'like', `${value}%`);
      }
    });
    equals.forEach((name) => {
      let value;
      if (isArray(name)) {
        let [column, alias] = name;
        value = getIfSet(args, alias);
        if (isNotUndefined(value)) {
          column = _resolveAlias(column, aliasLookup, entityName);
          builder.where(column, '=', value);
        }
      } else if (isNotUndefined(value = getIfSet(args, name))) {
        const column = _resolveAlias(name, aliasLookup, entityName);
        builder.where(column, '=', value);
      }
    });
    oneOf.forEach((name) => {
      let value;
      if (isArray(name)) {
        let [column, alias] = name;
        value = getIfSet(args, alias);
        if (isString(value)) {
          value = split(value);
        }
        if (isNotUndefined(value)) {
          column = _resolveAlias(column, aliasLookup, entityName);
          builder.whereIn(column, value);
        }
      } else if (isNotUndefined(value = getIfSet(args, name))) {
        if (isString(value)) {
          value = split(value);
        }
        const column = _resolveAlias(name, aliasLookup, entityName);
        builder.whereIn(column, value);
      }
    });
    dateRange.forEach((name) => {
      let value;
      const alias = _resolveAlias(name, aliasLookup, entityName);
      applyDateRange(alias, name, builder, args)
    });
  };

};

const _getListArgs = ( ctx = {} ) => {
  const listArgs = ['page', 'limit'];
  const orderable = ctx.orderable || null;
  const orderArgs = ['orderBy', 'orderDir'];

  if (isArray(ctx.listArgs)) {

    return orderable
      ? uniqueArray(ctx.listArgs.concat(listArgs).concat(orderArgs))
      : uniqueArray(ctx.listArgs.concat(listArgs));

  } else if (isObject(ctx.onBuildListWhere)) {

    const whereOpts = ctx.onBuildListWhere;

    // equals, like, oneOf
    for (const whereType in whereOpts) {
      const fields = whereOpts[whereType];
      if (whereType === 'dateRange') {
        if (isArray(fields)) {
          listArgs.push(fields.flatMap((name) => [
            `${name}Start`,
            `${name}End`,
          ]));
        }
      }
      if (isArray(fields)) {
        listArgs.push(...fields);
      }
    }

    return orderable
      ? uniqueArray(listArgs.concat(orderArgs))
      : uniqueArray(listArgs);
  }

  return orderable
    ? listArgs.concat(orderArgs)
    : listArgs;
}

/*
 * @param Object ctx - A contextual configuration object passed to all
 *   method factories
 * @param Array fns - An array of method factories. Each element must
 *   be a function that produces an ES5 function, or an array where
 *   index 0 is the method factory and index 1 is a sub-context that
 *   overrides the papa bear ctx object
 */
const modelFromContext = (ctx, fns) => {

  const {
    entityName,
    schema,
    loggerLib,
    services: {
      dbService,
      modelService,
    },
    logger = loggerLib ? loggerLib(`@mazeltove/core/lib/model`) : global.console,
  } = ctx;

  if (!entityName) {
    throw new Error('entityName is required for modelFromContext');
  }

  // TODO: use entityInfo instead of computing many of the values here
  // like the different case names and so on.
  const entityInfo = modelService.getEntityInfo(`${schema}.${entityName}`);
  const entityActions = modelService.getEntityActions();

  const
  pascalEntity = pascalCase(entityName),
  entityLabel = capitalCase(entityName);

  ctx.joins = _preprocessJoins(ctx.joins || []);

  const iface = fns.map((fnOrArr, index) => {

    if (isArray(fnOrArr)) {

      if (isString(fnOrArr[0])) {
        const actionName = fnOrArr[0];
        const actionInfo = entityActions[actionName] || {};
        const { fn } = actionInfo;

        if (!isFunction(fn)) {
          logger.error('Unrecognized action: "%s"', actionName)
          return null;
        }

        return fn({
          logger,
          pascalEntity,
          entityLabel,
          entityInfo,
          db: dbService,
          ...ctx,
          ...(fnOrArr[1] || {}),
        });
      }

      return fnOrArr[0]({
        logger,
        pascalEntity,
        entityLabel,
        entityInfo,
        db: dbService,
        ...ctx,
        ...(fnOrArr[1] || {}),
      });

    } else if (isString(fnOrArr)) {

      const actionName = fnOrArr;
      const actionInfo = entityActions[actionName] || {};
      const { fn } = actionInfo;

      if (!isFunction(fn)) {
        logger.error('Unrecognized action: "%s"', actionName)
        return null;
      }

      return fn({
        logger,
        pascalEntity,
        entityLabel,
        entityInfo,
        db: dbService,
        ...ctx,
      });

    } else if (isFunction(fnOrArr)) {

      return fnOrArr({
        logger,
        pascalEntity,
        entityLabel,
        entityInfo,
        db: dbService,
        ...ctx,
      });

    }

    throw new TypeError(fmt([
      'Array or function required for modelFromContext',
      'method builders. Got type of %s for index %s of %s',
    ].join(' '), typeof fnOrArr, index, entityName));

  })
  .filter((fn) => fn !== null)
  .reduce((iface, fn) => ({
    ...iface,
    [fn.name]: fn.bind(iface),
    [`${fn.name}${pascalEntity}`]: fn.bind(iface),
  }), {});

  // TODO: use _entityInfo to expose metadata related to this
  // model. Replace any properties properties eblow that are
  // practical (like the cased names, schema, keys and fields)
  // things like joins, selectArgs and columns for actions
  // may not be practical to replace.
  iface._entityInfo = entityInfo;

  // TODO: weed out where these are used and replace with entityInfo
  // above.

  iface._entityName = entityInfo.entityName;
  iface._entityNamePlural = entityInfo.entityNamePlural;
  iface._entityLabel = entityInfo.entityLabel;
  iface._entityLabelPlural = entityInfo.entityLabelPlural;
  iface._pascalName = pascalEntity;
  iface._createColumns = arrayIntersect(ctx.createColumns || [], entityInfo.columns);
  iface._updateColumns = arrayIntersect(ctx.updateColumns || [], entityInfo.columns);
  iface._selectColumns = arrayIntersect(ctx.selectColumns || [], entityInfo.columns);
  iface._keys = _makeKeys(arrayIntersect(ctx.key || ['id'], entityInfo.key));
  iface._selectArgs = _makeSelectArgs(ctx.selectColumns, entityName);
  iface._aliasLookup = _makeAliasLookup(iface._selectArgs);
  iface._joins = ctx.joins || [];
  iface._joinTypesOrdered = _getJoinCallsInOrder(ctx.joins || []);
  iface._validators = ctx.validators || {};
  iface._listArgs = _getListArgs(ctx);

  return iface;

};

module.exports = {
  _applyBulkWhere,
  _getJoinTableMap,
  _getJoinTables,
  _getSelectColumnTables,
  _joinsAreValid,
  _makeKeys,
  _makeSelectArgs,
  _makeProfileId,
  _mapInternalSchemaType,
  _makeAliasLookup,
  _makeWhere,
  _preprocessJoins,
  _resolveAlias,
  _select,
  applyDateRange,
  modelFromContext,
  makeWhereBuilder,
};
