const {
  pascalCase,
  capitalCase,
} = require('change-case');

const {
  collection: {
    compareObjectsLoose,
    subObject,
    getIfSet,
  },
  type: {
    isNotNull,
    isFunction,
  },
  error: {
    UnprocessableEntityError,
  },
} = require('../util');

const {
  _makeKeys,
  _makeSelectArgs,
  _makeAliasLookup,
  _joinsAreValid,
  _select,
  _applyBulkWhere,
  _makeProfileId,
} = require('./util');

/*
 * Bulk creator
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    logger,
    entityName,
    pascalEntity,
    key = 'id',
    fnName = 'bulkCreate',
    schema = 'public',
    bulkCreateRecordsKey = `${entityName}List`,
    onWillBulkCreate = null,
    argKeysMustMatch = null,
    selectColumns,
    joins = [],
  } = ctx;

  const
  keys                  = _makeKeys(key),
  selectArgs            = _makeSelectArgs(selectColumns, entityName),
  useJoins              = _joinsAreValid(joins),
  useWillBulkCreateHook = isFunction(onWillBulkCreate),
  aliasLookup           = _makeAliasLookup(selectArgs);

  const matchKeys = isNotNull(argKeysMustMatch)
    ? _makeKeys(argKeysMustMatch)
    : null;

  const bulkCreate = async function ( args = {}, passedTrx = null) {

    logger.info('%s%s: %o', fnName, pascalEntity, args);

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const records = getIfSet(args, bulkCreateRecordsKey, []);

    const { returnResults = false } = args;

    if (!records.length) {
      return {
        success: false,
        key: 'no_records',
        reason: `No records passed to "${bulkCreateRecordsKey}"`,
      };
    }

    if (isNotNull(matchKeys)) {

      const mustMatch = subObject(args, matchKeys);

      logger.debug('checking all %s match %o', bulkCreateRecordsKey, mustMatch)

      const doRecordsMatch = compareObjectsLoose(mustMatch, ...records);

      if (!doRecordsMatch) {
        logger.profile(profileId);
        throw new UnprocessableEntityError([
          'All', entityLabel,'records must match on the',
          ...matchKeys.map(capitalCase), 'keys',
        ].join(' '));
      }

    }

    const trx = passedTrx === null
      ? await db.transaction()
      : passedTrx;

    try {

      const nextRecords = useWillBulkCreateHook
        ? onWillBulkCreate(records, args)
        : records;

      const [ ...ids ] = await trx(entityName)
        .withSchema(schema)
        .returning(keys)
        .insert(nextRecords);

      if (returnResults) {
        const result = await _select(
          trx.withSchema(schema),
          selectArgs,
          entityName,
          joins,
          useJoins,
          (builder) => {
            _applyBulkWhere(builder, ids, keys, aliasLookup, trx, logger);
          }
        );

        logger.profile(profileId);

        return {
          success: true,
          inserts: result.length,
          result,
        };

      }

      logger.profile(profileId);

      if (passedTrx === null) {
        await trx.commit();
      }

      return { success: true };

    } catch (error) {

      logger.error('%o', error);

      if (passedTrx === null) {
        await trx.rollback();
      }

      throw error;
    }

  };

  if (fnName !== 'bulkCreate') {
    Object.defineProperty(bulkCreate, 'name', { value: fnName });
  }

  return bulkCreate;

};
