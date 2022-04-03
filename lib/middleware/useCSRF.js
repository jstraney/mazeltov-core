const {
  rand: {
    randStr,
  },
} = require('../util');

const wrap = require('./wrap');

module.exports = ( config = {} ) => {

  const {
    byteLen = 32,
    key = 'csrfToken',
    enc = 'base64',
    logger = global.console,
    queueLength = 5,
    onMethods = ['get'],
  } = config;

  return wrap(async function useCSRF (req, res, next) {

    // ignore methods of post, put, head by default
    if (!onMethods.includes(req.method.toLowerCase())) {
      return next();
    }

    const newCsrfToken = randStr(byteLen, enc);

    logger.debug('new csrf token generated: %s', newCsrfToken);

    // store the csrf token into the session
    if (!req.session) {
      throw new Error('session is required to useCSRF middleware');
    }

    // store token in locals for embedding in form. always use latest
    // for locals which are passed to templates.
    res.locals[key] = newCsrfToken;

    const tokens = req.session[key]
      ? [...req.session[key], newCsrfToken]
      : [newCsrfToken];

    req.session[key] = tokens.length > queueLength
      ? tokens.slice(1)
      : tokens;

    next();

  });

};
