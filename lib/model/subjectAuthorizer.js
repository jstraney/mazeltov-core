const pluralize = require('pluralize');

const {
  format: fmt,
} = require('util');

const {
  camelCase,
  pascalCase,
} = require('change-case');

const {
  logic: {
    and,
    andArr,
    orArrQ,
    orArr,
  },
  type: {
    isArray,
    isFunction,
    isNotFunction,
    isNotString,
    isString,
    isNull,
  },
  collection: {
    hasKey,
    getIfSet,
  },
  error: {
    ForbiddenError,
  },
} = require('../util');

const {
  _makeAliasLookup,
  _makeKeys,
  _makeProfileId,
} = require('./util');

/*
 * A subject in the scheme of authorization is
 * the sub claim of a JWT. This will be the personId
 * or client_id of the person or application that created the
 * JWT. This is always passed as _subject to models by
 * canAccess middleware
 *
 * permissions always follow the naming scheme of
 *
 * can <action> [perm-scope] <entity-name>
 *
 * where <action> is access by default but could be anything
 * you'd like (but get, create, update, list and other verbs should be
 * used by default.)
 *
 * <perm-scope> MUST be either "any" or "own" or completely absent if
 * a permission is non-scoped (can view adminPage, can list permission)
 *
 * <entity-name> is the table name or resource and must be a single camelcase token.
 *
 * all tokens are camelCase
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    fnName = 'canAccess',
    entityInfo,
    logger,
    ownershipArg = null,
    ownershipColumn = null,
    recordGetter = null,
    selectArgs,
    scoped = false,
  } = ctx;

  const {
    entityName,
    entityLabel,
    pascalEntity,
    key = ['id'],
  } = entityInfo;

  const actionName = camelCase(fnName.replace(/^can(?=[A-Z0-9_])/, ''));

  const isBulk = /^bulk/.test(actionName);

  // It's a lot of replacements but this only runs once before producing the
  // function below so it should not be too expensive.
  const errorMessage = 'You do not have permission to ' + actionName
    .replace(' list ', ' search ')
    .replace(' own ', ' your own ')
    .replace(' any ', ' anyone\'s ')
    .replace(` ${entityName}`, ` ${pluralize(entityLabel)}.`);

  const keys = _makeKeys(key);

  const aliasLookup = _makeAliasLookup(selectArgs);

  const canAccess = async function ( args = {} ) {

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const {
      _subject = null,
      _scopes = [],
      _subjectPermissions = {},
      _subjectIsAdmin = false,
    } = args;

    if (isNull(_subject)) {
      const err = new ForbiddenError(errorMessage);
    }

    // administrative roles bypass permissions.
    if (_subjectIsAdmin) {
      return true;
    }

    if (scoped === true) {

      if (isBulk) {
        return bulkActionInScope({
          _subject,
          _subjectPermissions,
          actionName,
          aliasLookup,
          args,
          db,
          entityName,
          errorMessage,
          keys,
          logger,
          ownershipArg,
          ownershipColumn,
          profileId,
          self: this,
          recordGetter,
        });
      } else {
        return actionInScope({
          _subject,
          _subjectPermissions,
          actionName,
          args,
          entityName,
          errorMessage,
          keys,
          logger,
          ownershipArg,
          ownershipColumn,
          profileId,
          self: this,
          recordGetter,
        });
      }

    } else {

      // e.g. can create person. Usually for the create action
      // but could be used for a generic case (can list logEntries)
      logger.profile(profileId);
      return hasKey(_subjectPermissions, `can ${actionName} ${entityName}`);

    }

    logger.profile(profileId);
    return true;

  };

  if (fnName !== 'canAccess') {
    Object.defineProperty(canAccess, 'name', { value: fnName});
  }

  return canAccess;

};

const bulkActionInScope = async ( inScopeArgs = {} ) => {

  const {
    _subject,
    _subjectPermissions,
    actionName,
    aliasLookup,
    args,
    db,
    entityName,
    errorMessage,
    keys,
    logger,
    ownershipArg,
    ownershipColumn,
    profileId,
    self,
    recordGetter,
  } = inScopeArgs;

  if (andArr([ownershipArg, ownershipColumn].map(isNull))) {
    logger.profile(profileId);
    return hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`);
  } else if (ownershipArg) {

    const entityList = args[`${entityName}List`] || [];

    let permScope = own;

    for (const record of entityList) {
      if (getIfSet(record, ownershipColumn) != _subject) {
        permScope = 'any';
        break;
      }
    }

    if (permScope === 'any') {
      logger.profile(profileId);
      return hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`);
    } else if (permScope === 'own') {
      logger.profile(profileId);
      // if you can <action> any <entityName> you can <action> your own
      return orArr([
        hasKey(_subjectPermissions, `can ${actionName} own ${entityName}`),
        hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`)
      ]);
    }

  } else if (ownershipColumn) {

    let dbRecords;

    if (isFunction(recordGetter)) {
      dbRecords = await recordGetter(args)
    } else {
      dbRecords = await db(entityName)
        .withSchema(schema)
        .where((builder) => {
          _applyBulkWhere(builder, records, keys, aliasLookup, db, logger);
        });
    }

    if (records.length === 0) {
      throw new ForbiddenError(errorMessage);
    }

    let permScope = 'own'

    for (const record of dbRecords) {
      if (getIfSet(record, ownershipColumn) != _subject) {
        permScope = 'any';
        break;
      }
    }

    if (permScope === 'any') {
      logger.profile(profileId);
      return hasKey(_subjectPermissions, `can ${actionName} ${permScope} ${entityName}`);
    } else if (permScope === 'own') {
      logger.profile(profileId);
      // if you can <action> any <entityName> you can <action> your own
      return orArr([
        hasKey(_subjectPermissions, `can ${actionName} own ${entityName}`),
        hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`)
      ]);
    }

  }

  return false;

};

const actionInScope = async ( inScopeArgs = {} ) => {

  const {
    _subject,
    _subjectPermissions,
    actionName,
    args,
    entityName,
    errorMessage,
    logger,
    ownershipArg,
    ownershipColumn,
    profileId,
    self,
    recordGetter,
  } = inScopeArgs;

  if (andArr([ownershipArg, ownershipColumn].map(isNull))) {
    logger.profile(profileId);
    return hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`);
  } else if (ownershipArg) {

    const permScope = getIfSet(args, ownershipArg) == _subject
      ? 'own'
      : 'any';

    if (permScope === 'any') {
      logger.profile(profileId);
      return hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`);
    } else if (permScope === 'own') {
      logger.profile(profileId);
      // if you can <action> any <entityName> you can <action> your own
      return orArr([
        hasKey(_subjectPermissions, `can ${actionName} own ${entityName}`),
        hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`)
      ]);
    }

  } else if (ownershipColumn) {

    const row = isFunction(recordGetter)
      ? await recordGetter(args)
      : await self.get(args);

    if (isNull(row)) {
      throw new ForbiddenError(errorMessage);
    }

    const permScope = getIfSet(row, ownershipColumn) == _subject
      ? 'own'
      : 'any';

    if (permScope === 'any') {
      logger.profile(profileId);
      return hasKey(_subjectPermissions, `can ${actionName} ${permScope} ${entityName}`);
    } else if (permScope === 'own') {
      logger.profile(profileId);
      // if you can <action> any <entityName> you can <action> your own
      return orArr([
        hasKey(_subjectPermissions, `can ${actionName} own ${entityName}`),
        hasKey(_subjectPermissions, `can ${actionName} any ${entityName}`)
      ]);
    }

  }

  return false;

}
