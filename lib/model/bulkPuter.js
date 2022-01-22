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

/**
 * A bulk put operation will take an entityList and transactionalize:
 * - removing all records outside of the set
 * - inserting the new records
 *
 * This is not a good operation for very large tables (hundreds of thousands)
 * of records, but should work okay for smaller tables
 *
 * This action is used for personRoles and rolePermissions
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    logger,
    entityName,
    pascalEntity = pascalCase(entityName),
    key = 'id',
    fnName = 'bulkPut',
    schema = 'public',
    bulkPutRecordsKey = `${entityName}List`,
    argKeysMustMatch = null,
    selectColumns = [],
  } = ctx;

  const keys = _makeKeys(key);

  const selectArgs = _makeSelectArgs(selectColumns, entityName);

  const matchKeys = isNotNull(argKeysMustMatch)
    ? _makeKeys(argKeysMustMatch)
    : null;

  const aliasLookup = _makeAliasLookup(selectArgs);

  const bulkPut = async ( args = {}, passedTrx = null) => {

    logger.info('%s%s: %o', fnName, pascalEntity, args);

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const records = getIfSet(args, bulkPutRecordsKey, []);

    if (!records.length) {
      logger.profile(profileId);
      return {
        success: false,
        key: 'no_records',
        reason: `No records passed to "${bulkPutRecordsKey}"`,
        numPut: 0,
      };
    }

    if (isNotNull(matchKeys)) {

      const mustMatch = subObject(args, matchKeys);

      logger.debug('checking all %s match %o', bulkPutRecordsKey, mustMatch)

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

      const { numRemoved } = await trx(entityName)
        .withSchema(schema)
        .where((builder) => {
          _applyBulkWhere(builder, records, keys, aliasLookup, trx, logger, true);
        })
        .del()
        .then((numRemoved = 0) => ({
          numRemoved
        }));

      const { numPut } = await trx(entityName)
        .withSchema(schema)
        .insert(records)
        .onConflict(keys)
        .merge()
        .then(( numPut = 0 ) => ({
          numPut,
        }));

      logger.profile(profileId);

      return {
        numPut,
        numRemoved,
      };

    } catch (error) {

      logger.error('Error bulk puting %s: %o', entityName, error);

      throw error;

    }

  };

  if (fnName !== 'bulkPut') {
    Object.defineProperty(bulkPut, 'name', { value: fnName });
  }

  return bulkPut;


};
