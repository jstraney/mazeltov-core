const {
  string: {
    beginsWith,
    endsWith,
    camelCase,
    pascalCase,
    sentenceCase,
    snakeCase,
    pluralize,
  },
  type: {
    isArray,
  },
  collection: {
    lookupMap,
    subObject,
  },
} = require('../lib/util');

const {
  bulkCreator,
  bulkMerger,
  bulkPuter,
  bulkRemover,
  bulkUpdater,
  creator,
  getter,
  introspector,
  iser,
  iterator,
  lister,
  merger,
  remover,
  softRemover,
  softRestorer,
  subjectAuthorizer,
  suggester,
  updater,
  validator,
  modelFromContext,
} = require('../lib/model');

module.exports = async ( ctx = {} ) => {

  const {
    services: {
      dbService,
      hookService,
    },
  } = ctx;

  // Switches on the unmodified attribute type of the postgres
  // table column to return a Javascript type
  hookService.onRedux('psqlToJsType', (_, psqlType) => {
    switch (psqlType) {
      case 'text':
      case 'character varying':
        return 'string';
      case 'bigint':
      case 'integer':
        return 'integer';
      case 'boolean':
        return 'boolean';
      default:
        return null;
    }
  });

  const getEntities = async () => {
    return dbService.raw(`
      SELECT
      tablename AS "entityName",
      schemaname AS "schema"
      FROM pg_catalog.pg_tables
      WHERE schemaname NOT IN ('public','pg_catalog','information_schema');
    `).then(({ rows = [] }) => rows.map((row) => ({
      ...row,
      entityName: camelCase(row.entityName),
      schema: camelCase(row.schema)
    })));
  };

  const getEntityColumns = async () => {
    return dbService.raw(`
    SELECT
    clss.relname AS "tableName",
    nsp.nspname AS "schema",
    attr.attname AS "name",
    format_type(attr.atttypid, NULL) AS "type",
    attr.attnotnull AS "notNullable",
    attr.atthasdef AS "hasDefault",
    CASE
      WHEN clss.relkind = 'S' THEN 'sequence'
      ELSE 'column'
    END AS "relKind"
    FROM pg_class clss, pg_attribute attr, pg_namespace nsp
    WHERE
    attr.attnum > 0
    AND NOT attr.attisdropped
    AND nsp.nspname NOT IN ('public','pg_catalog','information_schema','pg_toast')
    AND clss.relnamespace = nsp.oid
    AND attr.attrelid = clss.oid
    AND (
      (
        clss.relkind = 'S'
        AND attr.attname = 'last_value'
      )
      OR clss.relkind = 'r'
    );
    `).then(({ rows = [] }) => rows.map((row) => ({
      ...row,
      tableName: row.tableName.split('.').map(camelCase).join('.'),
      schema: camelCase(row.schema),
      name: camelCase(row.name),
    })));
  };

  // magically loads all userspace schemas. This cannot be hooked into
  // because redux is synchronous and this runs long before anything
  // could tie into it.
  const getUserSchemas = async () => {
    return dbService.raw(`
      SELECT
      schema_name as "schema"
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog','pg_toast','information_schema','public')
    `).then(({ rows = [] }) => rows.map(({schema}) => schema));
  };

  const allSchemas = await getUserSchemas();

  const getIndexes = async () => {

    const trx = await dbService.transaction();

    const searchPath = allSchemas
      .map((str) => `"${str}"`)
      .join(',');

    await trx.raw(`SET search_path = ${searchPath};`);

    const indexes = await trx.raw(`
      SELECT
      clss.relname::regclass AS "tableName",
      nsp.nspname AS "schema",
      attr.attname AS "name",
      ind.indisprimary AS "isPrimary",
      ind.indisunique AS "isUnique",
      ind.indnatts AS "numCols"
      FROM pg_index ind, pg_class clss, pg_attribute attr, pg_namespace nsp
      WHERE
      attr.attnum > 0
      AND pg_table_is_visible(clss.oid)
      AND ind.indrelid = clss.oid
      AND NOT attr.attisdropped
      AND nsp.nspname NOT IN ('public','pg_catalog','information_schema','pg_toast')
      AND clss.relnamespace = nsp.oid
      AND attr.attrelid = clss.oid
      AND attr.attnum = ANY(ind.indkey);
    `).then(({ rows = [] }) => rows.map((row) => ({
      ...row,
      tableName: row.tableName.split('.').map(camelCase).join('.'),
      name: camelCase(row.name),
    })));

    await trx.commit();

    return indexes;

  };

  const getForeignKeys = async () => {
    return dbService.raw(`
    SELECT
    tc.table_schema AS "tableSchema",
    tc.table_name AS "tableName",
    kcu.column_name AS "columnName",
    ccu.table_schema AS "foreignTableSchema",
    ccu.table_name AS "foreignTableName",
    ccu.column_name AS "foreignColumnName"
    FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      USING(constraint_schema, constraint_name)
    JOIN information_schema.constraint_column_usage AS ccu
      USING(constraint_schema, constraint_name)
    WHERE tc.constraint_type = 'FOREIGN KEY';
    `).then(({ rows = [] }) => rows.map((row) => ({
      ...row,
      tableSchema: camelCase(row.tableSchema),
      tableName: camelCase(row.tableName),
      columnName: camelCase(row.columnName),
      foreignTableSchema: camelCase(row.foreignTableSchema),
      foreignTableName: camelCase(row.foreignTableName),
      foreignColumnName: camelCase(row.foreignColumnName),
    })));
  };

  const _getEntityInfo = async () => {

    // if there is no core schema, or no user schemas, we
    // cannot use models.
    if (!allSchemas.length || !allSchemas.includes('mazeltov')) {
      return {};
    }

    const [
      entities,
      columns,
      indexes,
      fks,
    ] = await Promise.all([
      getEntities(),
      getEntityColumns(),
      getIndexes(),
      getForeignKeys(),
    ]);
    const entityInfo = {};
    for (const record of entities) {
      const {
        entityName,
        schema,
      } = record;
      const info = {
        entityName: camelCase(entityName),
        schema: camelCase(schema),
        entityNamePlural: pluralize(camelCase(entityName)),
        entityLabel: sentenceCase(entityName),
        entityLabelPlural: pluralize(sentenceCase(entityName)),
        pascalEntity: pascalCase(entityName),
        pascalEntityPlural: pluralize(pascalCase(entityName)),
        columns: [],
        key: [],
        uniqueCols: [],
        columnInfo: {},
        hasOne: [],
        hasMany: [],
        belongsToOne: [],
        belongsToMany: [],
        hasCompositeKey: false,
        hasIndex: false,
      };
      const entityId = `${schema}.${entityName}`;
      entityInfo[entityId] = info;
    }
    for (const record of columns.filter((row) => row.relKind === 'column')) {
      const {
        tableName,
        schema,
        name,
        hasDefault,
        notNullable,
        type,
      } = record;
      const entityId = `${schema}.${tableName}`;
      const columnInfo = {
        name: camelCase(name),
        label: sentenceCase(name),
        psqltype: type,
        hasDefault,
        notNullable,
        // TODO: figure this out. redux may not be feasible or
        // really reasonable to do.
        // jsType: hookService.redux('psqlToJsType', null, type),
      };
      //const [schema, entityName] = fullEntityName.split('.');
      //const entityId = `${schema}.${entityName}`;
      entityInfo[entityId].columnInfo[name] = columnInfo;
      entityInfo[entityId].columns.push(name);
    }
    for (const record of columns.filter((row) => row.relKind === 'sequence')) {
      const {
        tableName: relNameActually,
        schema,
        name,
        hasDefault,
        notNullable,
        type,
      } = record;
      // NOTE: Serials for columns other than 'id' not supported
      const tableName = relNameActually.replace(/IdSeq$/, '');
      const entityId = `${schema}.${tableName}`;
      entityInfo[entityId].columnInfo['id'].isSerial = true;
    }
    for (const record of indexes) {
      const {
        tableName: entityName,
        schema,
        name,
        type,
      } = record;
      const entityId = `${schema}.${entityName}`;
      const info = entityInfo[entityId];
      const columnInfo = info.columnInfo;
      info.hasIndex = true;
      columnInfo[name] = columnInfo[name];
      columnInfo[name].isPrimary = record.isPrimary || false;
      if (record.isPrimary) {
        info.key.push(name);
      }
      columnInfo[name].isUnique = record.isUnique || false;
      if (record.isUnique) {
        info.uniqueCols.push(name);
      }
      if (record.numCols > 1) {
        info.hasCompositeKey = true;
      }
    }
    // FKs that look like they may be on a pivot table
    // between two tables. for instance
    // person <- personRole -> role
    for (const record of fks) {
      const {
        tableSchema: schemaA,
        tableName: tableA,
        columnName: columnA,
        foreignTableSchema: schemaB,
        foreignTableName: tableB,
        foreignColumnName: columnB,
      } = record;

      const
      fullTableA = `${schemaA}.${tableA}`,
      fullTableB = `${schemaB}.${tableB}`,
      infoA = entityInfo[fullTableA],
      infoB = entityInfo[fullTableB],
      uniqueA = infoA.key.concat(infoA.uniqueCols),
      uniqueB = infoB.key.concat(infoB.uniqueCols),
      relA = buildRel(schemaB, tableB, columnB, columnA),
      relB = buildRel(schemaA, tableA, columnA, columnB);

      // a composite key in psql is usually used for
      // joining tables that support n-n relations
      if (infoB.hasCompositeKey) {
        infoA.belongsToMany.push(relA);
      } else if (uniqueB.includes(columnB)) {
        infoA.belongsToOne.push(relA);
      } else {
        infoA.belongsToMany.push(relA);
      }
      if (infoA.hasCompositeKey) {
        infoB.hasMany.push(relB);
      } else if (uniqueA.includes(columnA)) {
        infoB.hasOne.push(relB);
      } else {
        infoB.hasMany.push(relB);
      }

      // TODO: somehow discover joining tables
      // for n-to-n relationships:
      // - could check ending/begining of table name
      // - if it belongs to to other tables that
      //   form its names (e.g. rolePermission joins role and
      //   permission, ergo it is a joining table)
      // - could be used to auto-magically build methods like
      //   getXs where x is the related entity.
    }
    return entityInfo;
  };

  /*
   * builds a relationship descriptor object where:
   * on - refers to foreign table
   * by - refers to to the column on the table with the
   *   referencing column.
   */
  const buildRel = (onSchema, onTable, onColumn, byColumn) => ({
    schema: onSchema,
    table: onTable,
    onColumn,
    byColumn
  });

  hookService.onRedux('entityAction', (actions = {}) => ({
    ...actions,
    /** TODO: implement these to stability and include in
     * core API.
      merger,
      softRemover,
      softRestorer,
      suggester,
    */
    introspect: {
      fn: introspector,
      controller: ['cli'],
    },
    is: {
      fn: iser,
      controller: ['cli'],
    },
    canAccess: {
      fn: subjectAuthorizer,
      controller: ['cli'],
    },
    validate: {
      fn: validator,
      controller: ['cli'],
    },
    suggest: {
      fn: suggester,
      controller: ['cli', 'http'],
    },
    create: {
      fn: creator,
      controller: [
        'cli',
        'http',
      ],
    },
    get: {
      fn: getter,
      controller: [
        'cli',
        'http',
      ],
    },
    update: {
      fn: updater,
      controller: [
        'cli',
        'http',
      ],
    },
    remove: {
      fn: remover,
      controller: [
        'cli',
        'http',
      ],
    },
    list: {
      fn: lister,
      controller: [
        'cli',
        'http',
      ],
    },
    bulkRemove: {
      fn: bulkRemover,
      controller: [
        'cli',
        'http',
      ],
    },
    bulkCreate: {
      fn: bulkCreator,
      controller: [
        'cli',
        'http',
      ],
    },
    bulkUpdate: {
      fn: bulkUpdater,
      controller: [
        'cli',
        'http',
      ],
    },
    bulkMerge: {
      fn: bulkMerger,
      controller: [
        'cli',
        'http',
      ],
    },
    bulkPut: {
      fn: bulkPuter,
      controller: [
        'cli',
        'http',
      ],
    },
  }));

  const getEntityActions = (actions = null) => {
    if (!isArray(actions)) {
      return hookService
        .redux('entityAction', [])
    }
    const lookup = lookupMap(actions);
    return hookService
      .redux('entityAction', [])
      .filter((name) => lookup[name] === true);
  };

  // Preload entityInfo here because loading of services is
  // async but redux has not been made to be async as it would
  // be a breaking change. This allows preloaded entityInfo to
  // be passed into onRedux to be modified.
  const entityInfo = await _getEntityInfo();

  hookService.onRedux('entityInfo', (_) => entityInfo);

  const getEntityInfo = (fullName = null) => fullName === null
    ? hookService.redux('entityInfo')
    : hookService.redux('entityInfo')[fullName] || {};

  const registerModels = (nextModels = {}) => {
    hookService.onRedux('model', (models) => ({
      ...models,
      ...nextModels
    }));
  };

  const getModels = (names = null) => {
    return isArray(names)
      ? subObject(hookService.redux('model', {}), names)
      : hookService.redux('model', {})
  };

  return {
    getEntities,
    getEntityColumns,
    getEntityInfo,
    getIndexes,
    getEntityActions,
    getModels,
    registerModels,
  };

};
