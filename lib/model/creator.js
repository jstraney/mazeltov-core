const {
  pascalCase
} = require('change-case');

const {
  collection: {
    hasAnyKeys,
    peak,
    subObject,
  },
  type: {
    isFunction,
  },
  error: {
    ConflictError,
    ServerError,
  },
} = require('../util');

const {
  _joinsAreValid,
  _makeAliasLookup,
  _makeKeys,
  _makeSelectArgs,
  _makeWhere,
  _select,
} = require('./util');

/*
 * Creates a generic create function which creates exactly one record
 */
module.exports = ( ctx = {} ) => {

  const {
    entityInfo,
    db,
    logger,
    fnName = 'create',
    defaultCreateArgs = {},
    joins = [],
    createColumns = [],
    selectColumns = [],
    onWillCreate = null,
    onCreateResult = null,
  } = ctx;

  const {
    entityName,
    entityLabel,
    pascalEntity = pascalCase(entityName),
    schema = 'public',
    key = ['id'],
  } = entityInfo;

  if (!createColumns.length) {
    logger.warn('%s%s has no create columns. Was that intentional?', fnName, pascalEntity);
  }
  if (!selectColumns.length) {
    logger.warn('%s%s has no select columns. Was that intentional?', fnName, pascalEntity);
  }

  const
  keys                = _makeKeys(key),
  useWillCreateHook   = isFunction(onWillCreate),
  useCreateResultHook = isFunction(onCreateResult),
  selectArgs          = _makeSelectArgs(selectColumns, entityName),
  useJoins            = _joinsAreValid(joins),
  aliasLookup         = _makeAliasLookup(selectArgs);

  const create = async function ( args = {}, passedTrx = null) {

    logger.info('%s %s: %o', fnName, entityName, args);

    const profileId = `${args._uniqueRequestId} ${fnName}${pascalEntity} time`;
    logger.profile(profileId);

    const createArgs = subObject(args, createColumns, defaultCreateArgs);

    const trx = passedTrx === null
      ? db
      : passedTrx;

    let getArgs;

    try {

      // allow some args to be computed and not passed
      const nextCreateArgs = useWillCreateHook
        ? await onWillCreate(createArgs, args)
        : createArgs;

      const insertReturn = await trx.withSchema(schema)
        .returning(keys)
        .insert(nextCreateArgs)
        .into(entityName);

      getArgs = peak(insertReturn);

    } catch (error) {

      if (error.code == 23505) {
        throw new ConflictError(`${entityLabel} already exists`);
      } else {

        logger.error('Error creating %s: %o', entityName, error);

        throw new ServerError(`Could not create ${entityLabel.toLowerCase()}`);

      }

    }

    const row = await _select(
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
    ).then(([ row = null ]) => row);

    logger.profile(profileId);

    return useCreateResultHook
      ? onCreateResult(row)
      : row;

  };

  if (fnName !== 'create') {
    Object.defineProperty(create, 'name', { value: fnName });
  }

  return create;

};
