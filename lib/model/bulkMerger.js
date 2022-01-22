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
  _makeProfileId,
  _makeAliasLookup,
  _joinsAreValid,
  _select,
  _applyBulkWhere,
} = require('./util');

/*
 * A bulkMerger is used for many records that need to be inserted
 * and replaced if they exist. Useful for things like options
 * and form settings where they can be many records.
 *
 * One or more arg keys can be specified that each record
 * should match. for instance, if you were updating a customer preference:
 * {
 *   customerPersonId: 12,
 *   customerPreferences: {...},
 * }
 * By asserting argKeysMustMatch: 'customerPersonId', that means
 * the customerPersonId of each record must match that of the
 * outer payload. If an array is set for this option, each arg
 * must match.
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    logger,
    key = 'id',
    fnName = 'bulkMerge',
    entityName,
    pascalEntity = pascalCase(entityName),
    schema = 'public',
    onWillBulkMerge = null,
    entityLabel,
    joins = [],
    selectColumns = [],
    bulkMergeRecordsKey = `${entityName}List`,
    argKeysMustMatch = null,
  } = ctx;

  const keys = _makeKeys(key);

  const matchKeys = isNotNull(argKeysMustMatch)
    ? _makeKeys(argKeysMustMatch)
    : null;

  const
  selectArgs           = _makeSelectArgs(selectColumns, entityName),
  useJoins             = _joinsAreValid(joins),
  useWillBulkMergeHook = isFunction(onWillBulkMerge),
  aliasLookup          = _makeAliasLookup(selectArgs);

  const bulkMerge = async function ( args = {}, passedTrx = null) {

    logger.info('%s %s: %o', fnName, bulkMergeRecordsKey, args);

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const records = getIfSet(args, bulkMergeRecordsKey, []);

    if (records.length === 0) {
      logger.profile(profileId);
      return [];
    }

    if (isNotNull(matchKeys)) {

      const mustMatch = subObject(args, matchKeys);

      logger.debug('checking all %s match %o', bulkMergeRecordsKey, mustMatch)

      const doRecordsMatch = compareObjectsLoose(mustMatch, ...records);

      if (!doRecordsMatch) {
        logger.profile(profileId);
        throw new UnprocessableEntityError([
          'All', entityLabel,'records must match on the',
          ...matchKeys.map(capitalCase), 'keys',
        ].join(' '));
      }

    }

    const { returnResults = false } = args;

    const trx = passedTrx === null
      ? db
      : passedTrx;

    try {

      const nextRecords = useWillBulkMergeHook
        ? onWillBulkMerge(records, args)
        : records;

      await trx(entityName)
        .withSchema(schema)
        .insert(nextRecords)
        .onConflict(keys)
        .merge();

      if (returnResults) {

        const result = await _select(
          trx.withSchema(schema),
          selectArgs,
          entityName,
          joins,
          useJoins,
          (builder) => {
            _applyBulkWhere(builder, records, keys, aliasLookup, trx, logger);
          },
        );

        logger.profile(profileId);

        return result;

      }

      logger.profile(profileId);

      return { result: true };

    } catch (error) {

      logger.error('Error bulk merging %s: %o', entityName, error);

      throw error;

    }

  };

  if (fnName !== 'bulkMerge') {
    Object.defineProperty(bulkMerge, 'name', { value: fnName });
  }

  return bulkMerge;

};


