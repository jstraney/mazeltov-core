const {
  error: {
    UnauthorizedError,
  },
  type: {
    isObject,
    isString,
    isFunction,
  },
} = require('../util');

const {
  handleRequestError,
} = require('./errorHandlers');

const wrap = require('./wrap');

module.exports = (config = {}) => {

  const {
    key = 'csrfToken',
    errorTemplate = null,
    errorTemplateLocals = {},
    errorRedirectURL = null,
    authorizedHostname,
    hostnameHeader = 'referer',
    logger = global.console,
  } = config;

  if (!errorTemplate && !errorRedirectURL) {
    throw new Error('errorTemplate or errorRedirectURL is required for requireCSRF middleware');
  }

  if (!authorizedHostname) {
    logger.warn('An authorized hostname should be used for requireCSRF middleware');
  }

  return wrap(async function requireCSRF (req, res, next) {

    const header = req.header(hostnameHeader);
    const hostname = (new URL(header)).hostname;

    // reject request if referrer does not match
    if (isString(authorizedHostname)) {
      if (authorizedHostname !== hostname) {
        const error = new UnauthorizedError([
          'You are unauthorized from making this request.',
          'The page may require a refresh.',
        ].join(' '));

        return handleRequestError(req, res, error, errorTemplate, errorTemplateLocals, errorRedirectURL);
      }
    } else if (isFunction(authorizedHostname)) {
      const lookup = authorizedHostname(req, res);
      // allow function return map hostnames
      if (isObject(lookup) && lookup[hostname] === true) {
        const error = new UnauthorizedError([
          'You are unauthorized from making this request.',
          'The page may require a refresh.',
        ].join(' '));

        return handleRequestError(req, res, error, errorTemplate, errorTemplateLocals, errorRedirectURL);
      }
    }
    const { body = {} } = req;

    const token = body[key]

    const tokenStorage = req.session[key];

    logger.debug(
      'checking sent csrf against stored csrf: %s === %s',
      token,
      tokenStorage
    );

    // we still want to pass the latest csrf token we have to
    // locals so it may be rendered in form
    res.locals[key] = tokenStorage.slice(-1).pop();

    // if there is no token or they don't match render an error page
    if (!token || !tokenStorage || !tokenStorage.includes(token)) {

      logger.debug('csrf token failed');

      const error = new UnauthorizedError([
        'You are unauthorized from making this request.',
        'The page may require a refresh.',
      ].join(' '));

      return handleRequestError(req, res, error, errorTemplate, errorTemplateLocals, errorRedirectURL);

    }

    logger.debug('csrf token looks good!');

    next();

  });

};

