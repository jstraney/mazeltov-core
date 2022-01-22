const {
  pascalCase,
  capitalCase,
  pathCase,
} = require('change-case');

const {
  collection: {
    hasKey,
    subObject,
    hasElems,
  },
  logic: {
    and,
  },
} = require('../util');

const {
  _makeKeys,
  _makeSelectArgs,
  _makeProfileId,
  _joinsAreValid,
  _getJoinTables,
} = require('./util');

/**
 * TODO: this was an experimental feature to allow automatic
 * scaffolding of code using the database entity schema. This is
 * not complete but could be used to:
 *
 * * Build validators automatically
 * * Assist in building controllers
 * * Building Hypermedia (HATEOAS)
 *
 */

/*
 * The introspector retrieves internal information about the in code model
 * and fetches schema information from the database. This can be passed
 * off to other interfaces to propagate other code walkers
 * - This worlds discourse
 * - Is aleatoric
 * - Music played by
 * - Those agent machines
 * - All life is the
 * - Pseudo random
 * - Propagation of
 * - Those agent machines
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    logger,
    entityInfo,
    fnName = 'introspect',
    selectColumns = [],
    createColumns = [],
    updateColumns = [],
    joins = [],
    services: {
      modelService,
    },
  } = ctx;

  const {
    entityName,
    key = ['id'],
    schema = 'public',
    pascalName = pascalCase(entityName),
  } = entityInfo;

  const keys = _makeKeys(key);

  const uniqueColumns = [...(new Set([
    ...keys,
    ...selectColumns,
    ...createColumns,
    ...updateColumns,
  ]))];

  const selectArgs = _makeSelectArgs(selectColumns, entityName);

  const usesJoins = _joinsAreValid(joins);

  /*
   * TODO: return all actions and their route info
   * for the introspection.
   * const allActions = getEntityActions();
   */

  const
  canSelect   = hasElems(selectColumns),
  canUpdate   = hasElems(updateColumns),
  canCreate   = hasElems(createColumns),
  canRemove   = hasElems(keys),
  canGet      = and(canSelect, hasElems(keys)),
  canList     = and(canSelect, hasElems(keys));

  const
  joinedEntities = _getJoinTables(joins);

  async function introspect ( args = {} ) {

    const profileId = _makeProfileId(args, fnName, pascalName);
    logger.profile(profileId);

    const _columnInfo = await db(entityName)
      .withSchema(schema)
      .columnInfo();

    const columnInfo = subObject(_columnInfo, uniqueColumns);

    logger.profile(profileId);

    return {
      ...entityInfo,
      keys,
      selectArgs,
      createColumns,
      updateColumns,
      selectColumns,
      usesJoins,
      joins,
      joinedEntities,
    };

  };

  if (fnName !== 'introspect') {
    Object.defineProperty(introspect, 'name', { value: fnName });
  }

  return introspect

};
