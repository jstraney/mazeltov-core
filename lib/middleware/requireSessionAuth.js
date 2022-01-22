const url = require('url');

const {
  error: {
    UnauthorizedError,
  },
} = require('../util');

const {
  handleRequestError,
} = require('./errorHandlers');

const wrap = require('./wrap');

/**
 * Require a session identity to continue. If no identity exists
 * a redirect is made to a Uri (/sign-in) by default. A redirect is
 * done here because no identity exists (401 would be great but
 * cannot be used with redirect)
 */
module.exports = ( config = {} ) => {

  const {
    subjectKey = 'whoami',
    errorRedirectURL = '/sign-in',
    logger = global.console,
  } = config;

  return wrap(async function requireSessionAuth (req, res, next) {

    // TODO: implement. should redirect to an
    // unauthorized page (by configured URL) if
    // there is value under the subjectKey of the
    // session object
    if (!req.session || !req.session[subjectKey]) {

      // In the mazeltov project, a custom header called
      // X-Original-Url should be set by proxies. We should use this instead of
      // of originalUrl because haproxy may transform the path
      // before handing the request over.
      const originalPath = req.get('X-Original-Url') || req.originalUrl;

      // build a URL to the page that was requested. It is up to
      // the sign-in form to redirect us back here when the sign in
      // is successful
      let redirectBackUrl = url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: originalPath,
      });

      // encode the url back so it is safe for querystring
      encodeURIComponent(redirectBackUrl)

      // url.format will url encode query strings, if the original query
      // string is already url encoded, we do not want this to pass through
      // line above and instead do it here (full url needs to be decoded
      // before auth server redirects)
      redirectBackUrl += url.format({query: req.query});

      // e.g. /sign-in?redirect_url=https%3A%2F%2Fexample.com%2Fadmin
      const redirectURL = `${errorRedirectURL}?redirect_url=${redirectBackUrl}`;

      const error = new UnauthorizedError('You need to sign in first to access this page');

      return handleRequestError(req, res, error, null, null, redirectURL);

    }

    const whoami = req.session[subjectKey];

    // reconstruct claims from session for our authorization
    // middleware (which usually expects a JWT passed via locals)
    res.locals.claims = {
      sub: whoami.id,
      scope: 'person',
    };

    req.args = req.args || {};
    req.args._subject = whoami.id;
    req.args._scopes = ['person'];

    next();

  });

};
