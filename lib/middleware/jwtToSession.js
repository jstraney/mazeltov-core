const jwt = require('jsonwebtoken');

const {
  collection: {
    getIfSet,
  },
} = require('../util');

const wrap = require('./wrap');

module.exports = ( config = {} ) => {

  const {
    publicKeyPem,
    getPerson,
    subjectKey = 'whoami',
    accessTokenKey = 'access_token',
    logger = global.console,
    authorizedMethods = ['get'],
    models = {},
  } = config;

  const {
    personRoleModel,
  } = models;

  return wrap(async function jwtToSession (req, res, next) {

    if (!authorizedMethods.includes(req.method.toLowerCase())) {
      return next();
    }

    if (!req.session) {
      logger.warn('jwtToSession middleware requires a connect session');
      return next();
    }

    if (!req.signedCookies) {
      logger.warn('jwtToSession middleware requires signed cookies to be used');
      return next();
    }

    const whoami = req.session[subjectKey];

    if (whoami) {
      logger.debug('Session in place');
      return next();
    }

    const access_token = req.signedCookies[accessTokenKey];

    if (!access_token) {
      logger.debug([
        'No access token in signed cookie.',
        'Not attempting to make session'
      ].join(' '))
      return next();
    }

    const claims = await new Promise((resolve, reject) => {
      jwt.verify(access_token, publicKeyPem, (err, decoded) => {
        if (err == null) {
          return resolve(decoded);
        }
        logger.error('Issue decoding token: %o', err);
        res.clearCookie('refresh_token', {
          domain: req.get('host'),
        });
        res.clearCookie('access_token', {
          domain: req.get('host'),
        });
        return resolve(null);
      });
    });

    // not a valid identity, do not try to build base session
    if (claims === null) {
      logger.debug('Invalid access token in cookie. No session made');
      return next();
    }

    try {

      const person = await getPerson(claims.sub);

      if (!person) {
        logger.debug('Couldnt tie person to subject %s', claims.sub);
        return next();
      }

      logger.debug('session opened for: %o', person);

      const [
        permissions,
        isAdmin,
      ] = await Promise.all([
        personRoleModel.getPersonPermissions({
          personId: claims.sub,
        }).catch((error) => {
          logger.error('getPersonPermissions Error: %o', error);
          return {};
        }),
        personRoleModel.isPersonAdmin({
          personId: claims.sub,
        }).catch((error) => {
          logger.error('isPersonAdmin Error: %o', error);
          return false;
        }),
      ]);

      req.session[subjectKey] = {
        id: person.id,
        username: person.username,
        email: person.email,
        fullName: person.fullName,
        isAdmin,
        permissions,
      };

    } catch (error) {

      logger.error('Error getting person identity: %o', error);

    }

    next();

  });

};
