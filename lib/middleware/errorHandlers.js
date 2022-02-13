const {
  type: {
    isArray,
    isObject,
    isString,
  },
  error: {
    getHttpErrorStatusCode,
    isUserErrorCode,
  },
} = require('../util')

const {
  NODE_ENV,
} = process.env;

const isDevelopment = NODE_ENV === 'development';

const ERROR_UNCAUGHT_KEY = '_uncaught';

/**
 * In JavaScript anything is throwable, so we have to take
 * special care to handle anything that gets thrown passed
 * to res.locals.error
 */
const normalizeError = (error) => {

  const code = error.code;

  const errIsObject = typeof error === 'object';

  // any status code in the 400's is probably thrown
  // by us and is acceptable in a production environment
  // otherwise, we do not want internal errors to leak out
  // unless we're in development
  const
  hasKey     = errIsObject && isString(error.key),
  hasMessage = errIsObject && isString(error.message),
  hasList    = errIsObject && isArray(error.list),
  hasLookup  = errIsObject && isObject(error.lookup),
  hasHelp    = errIsObject && isString(error.help),
  showErrorMessage = (isDevelopment || isUserErrorCode(code)) && hasMessage;

  const nextError = {};

  if (hasList) {
    nextError.list = error.list.map(normalizeError);
  }

  if (hasLookup) {
    nextError.lookup = error.lookup;
  }

  return {
    ...nextError,
    key: hasKey
      ? error.key
      : '_uncaught',
    message: showErrorMessage
      ? error.message
      : 'An unexpected issue came up while processing your request.',
    help: hasHelp
      ? error.help
      : null,
    stack: error.stack || error.message,
  };

}

// Any middleware that handles errors before viewJSON should call this
// and pass the caught error
const handleRequestError = (req, res, error, errorTemplate = null, errorTemplateLocals = {}, errorRedirectURL = null) => {

  res.locals = res.locals || {};

  // if the error is of a special type, examine the code we
  // should produce (default 500)
  const code = getHttpErrorStatusCode(error);

  const result = res.locals.result || null;

  if (errorTemplate) {

    const flash = req.flash
      ? req.flash('all')
      : {};

    return res.render(errorTemplate, {
      result,
      error: normalizeError(error),
      lastSubmission: req.method === 'POST' ? req.body : req.query,
      ...errorTemplateLocals,
      ...flash
    });

  } else if (errorRedirectURL) {

    if (req.flash) {

      req.flash('lastSubmission', req.method === 'POST' ? req.body : req.query);
      req.flash('error', normalizeError(error));

      return res.redirect(errorRedirectURL);

    }

  }

  return res.status(code).json({
    result,
    error: normalizeError(error),
    ...errorTemplateLocals
  });

};

module.exports = {
  handleRequestError,
  normalizeError,
};
