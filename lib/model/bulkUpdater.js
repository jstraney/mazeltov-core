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
    fnName = 'bulkUpdate',
    schema = 'public',
    bulkUpdateRecordsKey = `${entityName}List`,
    onWillBulkUpdate = null,
    argKeysMustMatch = null,
    selectColumns,
    updateColumns,
    defaultUpdateArgs = {},
    joins = [],
  } = ctx;

  const
  keys                  = _makeKeys(key),
  selectArgs            = _makeSelectArgs(selectColumns, entityName),
  useJoins              = _joinsAreValid(joins),
  useWillBulkUpdateHook = isFunction(onWillBulkUpdate),
  aliasLookup           = _makeAliasLookup(selectArgs);

  const matchKeys = isNotNull(argKeysMustMatch)
    ? _makeKeys(argKeysMustMatch)
    : null;

  const bulkUpdate = async function ( args = {}, passedTrx = null) {

    logger.info('%s%s: %o', fnName, pascalEntity, args);

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const records = getIfSet(args, bulkUpdateRecordsKey, []);

    const { returnResults = false } = args;

    if (!records.length) {
      return {
        success: false,
        key: 'no_records',
        reason: `No records passed to "${bulkUpdateRecordsKey}"`,
      };
    }

    if (isNotNull(matchKeys)) {

      const mustMatch = subObject(args, matchKeys);

      logger.debug('checking all %s match %o', bulkUpdateRecordsKey, mustMatch)

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

      const nextRecords = useWillBulkUpdateHook
        ? onWillBulkUpdate(records, args)
        : records;

      for (const record of nextRecords) {
        const whereArgs = subObject(record, keys);
        const updateArgs = subObject(record, updateColumns, defaultUpdateArgs);

        await trx(entityName)
          .withSchema(schema)
          .update(updateArgs)
          .where(whereArgs)
          .catch((error) => {
            logger.error('%o', error);
            throw error;
          });
      };

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

        if (passedTrx === null) {
          await trx.commit();
        }

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

      passedTrx === null && trx.rollback();

      throw error;
    }

  };

  if (fnName !== 'bulkUpdate') {
    Object.defineProperty(bulkUpdate, 'name', { value: fnName });
  }

  return bulkUpdate;

};
