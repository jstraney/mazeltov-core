const {
  type: {
    isNotFunction,
  },
  error: {
    ForbiddenError,
  },
} = require('../util');

const {
  handleRequestError,
} = require('./errorHandlers')

const wrap = require('./wrap');

/*
  * @param function checkMethod
  *   A check method is provided (usually some kind of subjectAuthorizer;
  *   see mazeltov/model) that accepts:
  *   @param String _subject - subject id from JWT. usually the personId or clientID
  *   @param Array _scopes - array of scope strings. presently person and client are only supported.
  *   @param Object _subjectPermissions - string => boolean mapping of permissions
  *   @param Boolean _subjectIsAdmin - indicates person or client has one or more administrative role
  * @param Object personRoleModel - person role model interface
  * @param Object clientRoleModel - client role model interface
  * @param bypassPerson - do not check authorization for person tokens
  * @param bypassClient - do not check authorization for client tokens
  * @param logger - logger produced by lib.js.logger
  */
module.exports = ( config = {} ) => {

  const {
    checkMethod = null,
    bypassPerson = false,
    bypassClient = false,
    errorTemplate = null,
    errorTemplateLocals = null,
    errorRedirectURL = null,
    models = {},
    logger = global.console,
  } = config;

  const {
    personRoleModel,
    clientRoleModel,
    scopePermissionModel,
  } = models;

  [
    [personRoleModel, 'personRoleModel'],
    [clientRoleModel, 'clientRoleModel'],
    [scopePermissionModel, 'scopePermissionModel'],
  ].forEach(([val, label]) => {
    if (!val) {
      throw new Error(`${label} model is required for canAccess middleware`);
    }
  });

  if (isNotFunction(checkMethod)) {
    throw new Error([
      'checkMethod must be a function passed in to check the following args:',
      '_subject, _scopes, _subjectPermissions, and _subjectIsAdmin',
    ].join(' '));
  }

  return wrap(async function canAccess (req, res, next) {

    const {
      args,
    } = req;

    if (!args) {
      logger.warn('No args on req. did you pass useArgs middleware beforehand?');
    }

    /**
     * You need to use requireAuth, or requireSessionAuth middleware
     * before using this one.
     */
    const {
      claims = {},
    } = res.locals;

    const {
      sub = null,
      scope = '',
      aud = null,
    } = claims;

    const scopes = scope.split(',');

    const
    isPerson = scopes.includes('person'),
    isClient = scopes.includes('client');

    logger.debug('%s %s %o', sub, aud, scopes);

    try {

      if (isPerson && bypassPerson) {
        return next();
      } else if (isPerson) {

        logger.debug('Checking person access for id=%s', sub);

        let _subjectPermissions, _subjectIsAdmin;
        // a person may be tied to a session (if the request is
        // web based)
        if (req.session && req.session.whoami) {
          const {
            isAdmin,
            permissions,
          } = req.session.whoami;
          _subjectPermissions = permissions;
          _subjectIsAdmin = isAdmin;
        } else {

          const [
            subjectPermissions,
            subjectIsAdmin,
          ] = await Promise.all([
            personRoleModel.getPersonPermissions({
              personId: sub,
            }).catch((error) => {
              logger.error('getPersonPermissions Error: %o', error);
              return {};
            }),
            personRoleModel.isPersonAdmin({
              personId: sub,
            }).catch((error) => {
              logger.error('isPersonAdmin Error: %o', error);
              return false;
            }),
          ]);

          _subjectPermissions = subjectPermissions;
          _subjectIsAdmin = subjectIsAdmin;
        }

        logger.debug('person has administrative role: %s', _subjectIsAdmin);
        logger.debug('person permissions: %o', _subjectPermissions);

        let canAccess = false;

        // Check if audience and subject are the same. If not, this
        // is a delegated token (3rd party)
        if (aud && sub && aud != sub) {

          // additional scopes are only supported for person tokens
          // and for the auth code flow
          const scopePermissions = scopes.length > 1
            ? await scopePermissionModel.getLookup({ scopeNames: scopes })
            : null;

          const nextSubjectPermissions = scopePermissions === null
            ? _subjectPermissions
            : await scopePermissionModel.intersect({
              scopePermissions,
              personPermissions: _subjectPermissions
            });

          logger.debug('audience scoped permissions %o', nextSubjectPermissions);

          // No matter if the person is an admin, the scoped token will
          // treat it as if this is not an admin.
          canAccess = await checkMethod({
            ...args,
            _subject: sub,
            _scopes: scopes,
            _subjectPermissions: nextSubjectPermissions,
            _subjectIsAdmin: false,
          });

        } else {

          canAccess = await checkMethod({
            ...args,
            _subject: sub,
            _scopes: scopes,
            _subjectPermissions,
            _subjectIsAdmin,
          });

        }

        if (canAccess) {

          // attach the permissions for possible later use
          args._subject = sub;
          args._subjectPermissions = _subjectPermissions;
          args._subjectIsAdmin = _subjectIsAdmin;
          return next();
        }

      } else if (isClient && bypassClient) {

        return next();

      } else if (isClient) {

        logger.debug('Checking client access for id=%s', sub);

        const [
          _subjectPermissions,
          _subjectIsAdmin,
        ] = await Promise.all([
          clientRoleModel.getClientPermissions({
            clientId: sub,
          }).catch((error) => {
            logger.error('getClientPermissions Error: %o', error);
            return {};
          }),
          clientRoleModel.isClientAdmin({
            clientId: sub,
          }).catch((error) => {
            logger.error('isClientAdmin Error: %o', error);
            return false;
          }),
        ]);

        logger.debug('client has administrative role: %s', _subjectIsAdmin);
        logger.debug('client permissions: %o', _subjectPermissions);

        const canAccess = await checkMethod({
          ...args,
          _subject: sub,
          _scopes: scopes,
          _subjectPermissions,
          _subjectIsAdmin,
        });

        if (canAccess) {

          // attach the permissions for possible later use
          args._subject = sub;
          args._subjectPermissions = _subjectPermissions;
          args._subjectIsAdmin = _subjectIsAdmin;

          return next();

        }

      }

    } catch (error) {

      logger.error('%o', error);

      handleRequestError(req, res, error, errorTemplate, errorTemplateLocals, errorRedirectURL);

    }

    const defaultError = new ForbiddenError('This request is unauthorized');

    handleRequestError(req, res, defaultError, errorTemplate, errorTemplateLocals, errorRedirectURL);

  }, 'canAccess');

}
