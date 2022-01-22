const jwt = require('jsonwebtoken');

const {
  UnauthorizedError,
} = require('../util/error');

const {
  handleRequestError
} = require('./errorHandlers');

const wrap = require('./wrap');

// accepts a public key PEM text to verify the
// validity of a signed JWT in the Authorization header
module.exports = ( config = {} ) => {

  const {
    publicKeyPem,
    logger = global.console,
  } = config;

  if (!publicKeyPem) {
    throw new Error('public key PEM text is required for requireAuth middleware');
  }

  return wrap(async function requireAuth (req, res, next) {

    logger.debug('Checking access token in authorization header');

    // get the JWT from the authorization header
    const authHeader = req.get("authorization");

    if (!authHeader) {
      handleRequestError(req, res, new UnauthorizedError('Invalid authorization header'));
      return;
    }

    const [tokenType, token] = authHeader.split(' ');

    // set the res.locals for future middleware to handle
    // response. We may (unlikely) want XML, HTML, text
    // response and not necessarily JSON
    if (tokenType !== 'Bearer') {
      handleRequestError(req, res, new UnauthorizedError('Invalid token type'));
    }

    try {

      // verify the JWT using public RSA PEM
      const claims = jwt.verify(token, publicKeyPem);

      // attach the claims to res.locals
      // for other middleware
      res.locals.claims = claims

      logger.debug('Authorization header looks good');

      next();

    } catch (error) {

      logger.error('%o', error);

      handleRequestError(req, res, new UnauthorizedError('Invalid access token'));

    }

  });

}
