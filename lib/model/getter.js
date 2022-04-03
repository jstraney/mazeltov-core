const {
  pascalCase
} = require('change-case');

const {
  collection: {
    arrayDiff,
    arrayUnion,
    hasAnyKeys,
    hasNoElems,
    hasNoKeys,
    hasKey,
    subObject,
    numKeys,
  },
  type: {
    isArray,
    isFunction,
    isString,
  },
} = require('../util');

const {
  _joinsAreValid,
  _makeAliasLookup,
  _makeKeys,
  _makeProfileId,
  _makeSelectArgs,
  _makeWhere,
  _select,
} = require('./util');

/*
 * A getter selects one record. This should always be intended to
 * return one record. If you use hooks, you should always pass
 * extra args to WHERE that could return one row (such as a unique
 * column). Reasonable use-case would be getting a person record
 * by id or by username, or by email.
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    entityInfo,
    fnName = 'get',
    logger,
    joins = [],
    selectColumns = [],
    onGetResult = null,
    uniqueColumns = [],
    redactedColumns = [],
  } = ctx;

  const {
    entityName,
    pascalEntity = pascalCase(entityName),
    key = ['id'],
    schema = 'public',
  } = entityInfo;

  const nonRedacted = arrayDiff(arrayUnion(key, selectColumns), redactedColumns);

  const
  keys = _makeKeys(key),
  selectArgs = _makeSelectArgs(selectColumns, entityName),
  useJoins = _joinsAreValid(joins),
  useGetResultHook = isFunction(onGetResult),
  aliasLookup = _makeAliasLookup(selectArgs);

  const get = async function ( args = {} ) {

    logger.info('%s %s: %o', fnName, entityName, subObject(args, nonRedacted));

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const keyArgs = subObject(args, keys);

    const uniqueClauses = [];

    // now, for each unique key passed. each unique columns
    // could be a tupple of columns (in which case, AND is used)
    if (isArray(uniqueColumns)) {
      for (const col of uniqueColumns) {
        if (isString(col) && hasKey(args, col)) {
          uniqueClauses.push({[col]: args[col]});
        } else if (isArray(col)) {
          const subArgs = subObject(args, col);
          if (numKeys(subArgs) === col.length) {
            uniqueClauses.push(subArgs);
          }
        }
      }
    }

    // there is nothing to search by! return nothing; otherwise
    // knex would do a full table select and this is a get method
    // (should always return one thing).
    if (hasNoElems(uniqueClauses) && hasNoKeys(keyArgs)) {
      logger.warn(
        'No keys or unique clauses to select from for %s%s',
        fnName,
        pascalEntity
      );
      logger.profile(profileId);
      return useGetResultHook
        ? onGetResult(null, args)
        : null;
    }

    const whereFn = (builder) => {

      // always apply the keyArgs as direct lookups using AND.
      // this is to support composite primary keys
      if (hasAnyKeys(keyArgs)) {
        builder.where(_makeWhere(keyArgs, aliasLookup));
      }

      // now, for each unique key passed. each unique columns
      // could be a tupple of columns (in which case, AND is used)
      for (const clause of uniqueClauses) {
        builder.where(_makeWhere(clause, aliasLookup));
      }

    };

    const row = await _select(
      db.withSchema(schema),
      selectArgs,
      entityName,
      joins,
      useJoins,
      whereFn,
    ).then(([ row = null ]) => row);

    logger.profile(profileId);

    return useGetResultHook
      ? onGetResult(row, args)
      : row;

  };

  if (fnName !== 'get') {
    Object.defineProperty(get, 'name', { value: fnName });
  }

  return get;

};
