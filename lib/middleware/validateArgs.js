const {
  collection: {
    getIfSet,
  },
  validate: {
    validator,
  },
  error: {
    BadRequestError,
  },
} = require('../util');

const {
  handleRequestError,
} = require('./errorHandlers');

const wrap = require('./wrap');

// validates args (aggregated from query, body, params, headers using useArgs)
module.exports = ( config = {} ) => {

  const {
    logger = global.console,
    errorTemplate = null,
    errorTemplateLocals = {},
    errorRedirectURL,
    validator: passedValidator = null,
    ...validateConfig
  } = config;

  // ugly hack due to how httpControllers will strap these
  // globals into the middleware.
  delete validateConfig.services;
  delete validateConfig.models;

  const _validator = passedValidator !== null
    ? passedValidator
    : validator({
      ...validateConfig,
      collectAll: true,
    });

  return wrap(async function validateArgs (req, res, next) {

    const { args = {} } = req;

    logger.debug('validating request args');

    _validator(args)
    .then((success) => {

      logger.debug('All args good');

      next();

      return success;

    })
    .catch((error) => {

      logger.debug('Error in validateArgs: %o', error);

      return handleRequestError(req, res, error, errorTemplate, errorTemplateLocals, errorRedirectURL);

    });

  });

}
