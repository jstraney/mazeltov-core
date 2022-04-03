const {
  _makeKeys,
  _makeSelectArgs,
  _makeProfileId,
} = require('./util');

const {
  collection: {
    arrayDiff,
    arrayUnion,
    subObject
  },
  string: {
    joinWords,
  },
  type: {
    isFunction,
  },
  error: {
    ConflictError,
  },
} = require('../util');

/*
 * Generic remover function that removes one record
 */
module.exports = ( ctx = {} ) => {

  const {
    entityInfo,
    db,
    logger,
    fnName = 'remove',
    onWillRemove = null,
    onRemoveResult = null,
    redactedColumns = [],
  } = ctx;

  const {
    entityName,
    entityLabel,
    pascalEntity,
    key = ['id'],
    schema = 'public',
  } = entityInfo;

  const nonRedacted = arrayDiff(key, redactedColumns);

  const
  keys = _makeKeys(key),
  useWillRemoveHook = isFunction(onWillRemove),
  useRemoveResultHook = isFunction(onRemoveResult);

  const remove = async ( args = {}, passedTrx = null) => {

    logger.info('%s %s: %o', fnName, entityName, subObject(args, nonRedacted));

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const keyArgs = subObject(args, keys);

    const nextKeyArgs = useWillRemoveHook
      ? await onWillRemove(keyArgs, args)
      : keyArgs;

    const trx = passedTrx === null
      ? db
      : passedTrx;

    const [ extantRecord = null ] = await trx
      .withSchema(schema)
      .select(keys)
      .from(entityName)
      .where(nextKeyArgs);

    if (extantRecord === null) {
      throw new ConflictError(joinWords([
        entityLabel, 'cannot be removed',
        'because it does not exist',
      ]));
    }

    try {

      const result = await trx(entityName)
        .withSchema(schema)
        .where(nextKeyArgs)
        .del()
        .then((numRemoved = 0) => ({ numRemoved }));

      logger.profile(profileId);

      return useRemoveResultHook
        ? onRemoveResult(result, args)
        : result;

    } catch (error) {

      logger.error('Error removing %s: %o', entityName, error);

      throw error;

    }

  };

  if (fnName !== 'remove') {
    Object.defineProperty(remove, 'name', { value: fnName });
  }

  return remove;

};

