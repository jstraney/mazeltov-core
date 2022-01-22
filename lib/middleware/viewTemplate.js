const {
  type: {
    isObject,
  },
} = require('../util');

const {
  handleRequestError,
} = require('./errorHandlers');

const wrap = require('./wrap');

module.exports = ( config = {} ) => {

  if (!(config instanceof Object)) {
    throw new Error('viewTemplate expects an object for configuration');
  }

  // accepts a template for regular render (no res.locals.error)
  // and optionally a specific template for errors (usually
  // a submitting form)
  const {
    template,
    templateOnError = template,
    templateOnNoResult = template,
    requireResults = [],
  } = config;

  // must at least pass a template
  if (!template) {
    throw new Error('viewTemplate expects a template name');
  }

  return wrap(async function viewTemplate (req, res) {

    const {
      error,
      result = null,
    } = res.locals;

    const locals = {
      ...config,
      error
    };

    if (req.flash) {
      Object.assign(locals, req.flash('all'));
    }

    if (error) {
      return handleRequestError(req, res, error, templateOnError, locals, null);
    } else if (result === null) {
      return res.render(templateOnNoResult, locals);
    } else if (isObject(result) && requireResults.length) {
      for (const resultName of requireResults) {
        if (!result[resultName]) {
          return res.render(templateOnNoResult, locals);
        }
      }
    }

    res.render(template, locals);

  });

}
