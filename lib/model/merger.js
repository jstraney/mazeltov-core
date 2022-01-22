const {
  pascalCase
} = require('change-case');

const {
  collection: {
    subObject,
    hasAnyKeys,
  },
  type: {
    isFunction,
  },
} = require('../util');

const {
  _makeKeys,
  _makeProfileId,
  _makeSelectArgs,
  _makeAliasLookup,
  _makeWhere,
  _joinsAreValid,
  _select,
} = require('./util');


// TODO: test and refine. Mergers should be abandoned in favor
// of creators and updators. For certain cases, bulkMerger is
// most appropriate (like upserting user preferences).
module.exports = ( ctx = {} ) => {

  const {
    db,
    logger,
    entityName,
    pascalEntity = pascalCase(entityName),
    key = 'id',
    fnName = 'merge',
    schema = 'public',
    selectColumns = [],
    createColumns = [],
    joins = [],
    onWillCreate,
    onCreateResult,
  } = ctx;

  const
  keys       = _makeKeys(key),
  selectArgs = _makeSelectArgs(selectColumns, entityName),
  useJoins   = _joinsAreValid(joins),
  useWillCreateHook   = isFunction(onWillCreate),
  useCreateResultHook = isFunction(onCreateResult),
  aliaslookup         = _makeAliasLookup(selectArgs);

  const merge = async function ( args = {}, passedTrx = null) {

    logger.info('%s%s: %o', fnName, pascalEntity, args);

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const createArgs = subObject(args, createColumns, defaultCreateArgs);

    // allow some args to be computed and not passed
    const nextCreateArgs = useWillCreateHook
      ? await onWillCreate(createArgs, args)
      : createArgs;

    const trx = passedTrx === null
      ? db
      : passedTrx;

    const [ getArgs ] = await trx(entityName)
      .withSchema(schema)
      .returning(keys)
      .insert(nextCreateArgs)
      .onConflict(keys)
      .merge();

    const row = _select(
      trx.withSchema(schema),
      selectArgs,
      entityName,
      joins,
      useJoins,
      (builder) => {
        if (hasAnyKeys(getArgs)) {
          builder.where(_makeWhere(getArgs, aliasLookup));
        }
      },
    );

    logger.profile(profileId);

    return useCreateResultHook
      ? onCreateResult(row)
      : row;

  };

  if (fnName !== 'merge') {
    Object.defineProperty(merge, 'name', { value: fnName });
  }

  return merge;

};


