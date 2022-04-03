const {
  pascalCase
} = require('change-case');

const {
  collection: {
    arrayDiff,
    arrayUnion,
    subObject,
  },
  type: {
    isFunction,
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
 * Generic updater that updates a single record
 */
module.exports = ( ctx = {} ) => {

  const {
    entityInfo,
    db,
    logger,
    fnName = 'update',
    updateColumns = [],
    selectColumns = [],
    onWillUpdate = null,
    onUpdateResult = null,
    defaultUpdateArgs = {},
    redactedColumns = [],
    joins = [],
  } = ctx;

  const {
    entityName,
    pascalEntity = pascalCase(entityName),
    schema = 'public',
    key = ['id'],
  } = entityInfo;

  const nonRedacted = arrayDiff(arrayUnion(updateColumns, selectColumns), redactedColumns);

  if (fnName !== 'update' && !updateColumns.length) {
    logger.warn('%s%s has no update columns. Was that intentional?', fnName, pascalEntity);
  }

  if (fnName !== 'update' && !selectColumns.length) {
    logger.warn('%s%s has no select columns. Was that intentional?', fnName, pascalEntity);
  }

  const
  keys                = _makeKeys(key),
  selectArgs          = _makeSelectArgs(selectColumns, entityName),
  useWillUpdateHook   = isFunction(onWillUpdate),
  useUpdateResultHook = isFunction(onUpdateResult),
  useJoins            = _joinsAreValid(joins),
  aliasLookup         = _makeAliasLookup(selectArgs);

  const update = async function ( args = {}, passedTrx = null ) {

    logger.info('%s %s: %o', fnName, entityName, subObject(args, nonRedacted));

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const updateArgs = subObject(args, updateColumns, defaultUpdateArgs);

    const nextUpdateArgs = useWillUpdateHook
      ? await onWillUpdate(updateArgs, args)
      : updateArgs;

    const whereArgs = subObject(args, keys);

    const trx = passedTrx === null
      ? db
      : passedTrx;

    try {

      await trx.withSchema(schema)
        .update(nextUpdateArgs)
        .into(entityName)
        .where(whereArgs);

      const row = await _select(
        trx.withSchema(schema),
        selectArgs,
        entityName,
        joins,
        useJoins,
        (builder) => {
          builder.where(_makeWhere(whereArgs, aliasLookup));
        }
      ).then(([ row = null ]) => row);

      logger.profile(profileId);

      return useUpdateResultHook
        ? onUpdateResult(await row)
        : row;

    } catch (error) {

      logger.error('Error updating %s: %o', entityName, error);

      throw error;

    }

  };

  if (fnName !== 'update') {
    Object.defineProperty(update, 'name', { value: fnName });
  }

  return update;

};
