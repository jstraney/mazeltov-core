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
  },
  error: {
    UnprocessableEntityError,
  },
} = require('../util');

const {
  _applyBulkWhere,
  _makeAliasLookup,
  _makeKeys,
  _makeProfileId,
  _makeSelectArgs,
} = require('./util');

/*
 * Bulk remover
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    logger,
    entityName,
    pascalEntity = pascalCase(entityName),
    key = 'id',
    fnName = 'bulkRemove',
    schema = 'public',
    bulkRemoveRecordsKey = `${entityName}List`,
    argKeysMustMatch = null,
    selectColumns = [],
  } = ctx;

  const keys = _makeKeys(key);

  const selectArgs = _makeSelectArgs(keys, entityName);

  const matchKeys = isNotNull(argKeysMustMatch)
    ? _makeKeys(argKeysMustMatch)
    : null;

  const aliasLookup = _makeAliasLookup(selectArgs);

  const bulkRemove = async ( args = {}, passedTrx = null) => {

    logger.info('%s%s: %o', fnName, pascalEntity, args);

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const records = getIfSet(args, bulkRemoveRecordsKey, []);

    if (!records.length) {
      logger.profile(profileId);
      return {
        success: false,
        key: 'no_records',
        reason: `No records passed to "${bulkRemoveRecordsKey}"`,
        numRemoved: 0,
      };
    }

    if (isNotNull(matchKeys)) {

      const mustMatch = subObject(args, matchKeys);

      logger.debug('checking all %s match %o', bulkRemoveRecordsKey, mustMatch)

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
      ? db
      : passedTrx;

    try {

      const result = await trx(entityName)
        .withSchema(schema)
        .where((builder) => {
          _applyBulkWhere(builder, records, keys, aliasLookup, trx, logger);
        })
        .del()
        .then((numRemoved = 0) => ({
          success: true,
          numRemoved
        }));

      logger.profile(profileId);

      return result;

    } catch (error) {

      logger.error('Error bulk removing %s: %o', entityName, error);

      throw error;

    }

  };

  if (fnName !== 'bulkRemove') {
    Object.defineProperty(bulkRemove, 'name', { value: fnName });
  }

  return bulkRemove;

};
