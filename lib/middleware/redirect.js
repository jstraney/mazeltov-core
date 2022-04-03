const {
  type: {
    isArray,
    isString,
    isFunction,
  },
  string: {
    fmtVariables,
  },
} = require('../util');

const {
  handleRequestError,
} = require('./errorHandlers');

const wrap = require('./wrap');

/**
 * The redirect middleware will by default allow a body
 * or query parameter called _redirect to be used to send
 * the client elsewhere after the form is submitted.
 *
 * This most easily allows embeding a destination into forms
 * so that when an action is completed the client will go where
 * they are expecting (e.g. a form is submited to save a customer
 * account so it's expected to go to the /customers index with
 * a flash message of "customer record saved".
 *
 * Other options include:
 * - resultRedirectURL : a hardcoded URL when there is a result
 * - redirectFromResult : a property from result used as redirect URL
 * - errorRedirectURL : a redirect URL when an error is found
 * - allowExternal : false by default, allows redirects outside of the host
 *     set for SERVICE_HOSTNAME
 */
module.exports = ( config = {} ) => {

  // TODO: support a path style lookup for redirectFromArg and redirectFromResult:
  // would use json path style lookup
  const {
    redirectFromArg = null,
    redirectFromResult = null,
    redirectCode = 302,
    resultFlashMessage = null,
    allowExternal = false,
    logger = global.console,
    services: {
      routeService: {
        routeUri,
      },
    },
  } = config;

  let {
    resultRedirectURL = null,
    errorRedirectURL = resultRedirectURL,
  } = config;

  // test url to see if it is a symbolic route: e.g. list:app.account
  // relative URLs without leading slash are usually used for static assets
  // and are rarely used for form redirects (in my experience). Still someone
  // might really need that funcionality so it may be worth a bool in config
  // to bypass this.
  const plainUrlExp = /^(?:\/|https?:\/\/)/;
  if (!plainUrlExp.test(resultRedirectURL)) {
    resultRedirectURL = routeUri(resultRedirectURL) || resultRedirectURL;
  }
  if (!plainUrlExp.test(errorRedirectURL)) {
    errorRedirectURL = routeUri(errorRedirectURL) || errorRedirectURL;
  }

  return wrap(async function redirect (req, res) {

    const {
      result,
      error,
    } = res.locals;

    if (error && errorRedirectURL) {
      return handleRequestError(req, res, error, null, null, errorRedirectURL);
    }

    if (result && isString(resultFlashMessage)) {
      req.flash('message', resultFlashMessage);
    } else if (result && isFunction(resultFlashMessage)) {
      req.flash('message', resultFlashMessage({ result, args: req.args}));
    }

    let url;

    if (redirectFromArg) {
      url = req.args[redirectFromArg];
    } else if (redirectFromResult && result) {
      url = result[redirectFromResult];
    } else if (result && resultRedirectURL) {
      url = resultRedirectURL;
    } else if (req.body._redirect) {
      url = req.body._redirect;
    } else if (req.query._redirect) {
      url = req.query._redirect;
    } else {
      url = '/';
    }
    // due to extended form encoding, it's not unlikely that an array
    // could be passed (in the case of multiple _redirect inputs). just
    // use the last value if url somehow became an array
    url = isArray(url) ? url.pop() : url;

    // sanitize URL as it may come from an invader
    // absolute URIs should resolve to same host and won't parse as
    // a WHATWG URL
    if (!allowExternal && !/^\/|^back$/.test(url)) {

      try {
        const u = new URL(url);

        url = u.hostname === req.app.locals.SERVICE_HOSTNAME
          ? url
          : '/';

      } catch (error) {
        logger.error('%o', error);
        url = '/';
      }
    }

    return res.status(redirectCode).redirect(url);

  });

};
