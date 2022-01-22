const {
  type: {
    isArray,
    isString,
  },
  map: {
    objectMapper,
  },
} = require('../util');

const wrap = require('./wrap');

module.exports = (config = {}) => {

  const {
    body: fromBody = [],
    files: fromFiles = [],
    query: fromQuery = [],
    params: fromParams = [],
    claims: fromClaims= [],
    req: fromReq = [],
    res: fromRes = [],
    session: fromSession = [],
    head: fromHead = [],
    static: staticArgs = {},
    map = null,
    services: {
      webControllerService,
      hookService,
    },
    logger = global.console,
  } = config;

  const mapper = map === null
    ? null
    : objectMapper(map);

  const copyProperty = (key, from = {}, to = {}) => {
    if (isString(key) && from[key]) {
      to[key] = from[key];
      return;
    } else if (isArray(key) && key.length === 2) {
      const [source, alias] = key;
      if (from[source]) {
        to[alias] = from[source];
      }
      return;
    }
  };

  return wrap(async function useArgs (req, res, next) {

    // static args are constants always passed off by request
    // using splat operator here allows the defaults to be overriden
    // but only if we specify them as coming from body, query, params etc.
    // otherwise, they are fixed.
    const args = req.args
      ? {...req.args, ...staticArgs}
      : {...staticArgs};

    // copy values from body, query, params
    fromBody.forEach((key) => copyProperty(key, req.body, args));
    fromQuery.forEach((key) => copyProperty(key, req.query, args));
    fromParams.forEach((key) => copyProperty(key, req.params, args));
    fromFiles.forEach((key) => copyProperty(key, req.files, args));

    // copy values directly from request and response objects
    fromReq.forEach((key) => copyProperty(key, req, args));
    fromRes.forEach((key) => copyProperty(key, res, args));

    const session = req.session;

    // copy from session if it exists and inspected values were specified.
    if (session) {
      fromSession.forEach((key) => copyProperty(key, session, args));
    }

    // copy headers
    for (const header of fromHead) {

      const headerContent = req.get(header);

      if (headerContent !== undefined) {
        args[key] = headerContent;
      }

    }

    // TODO: reevaluate use-case. We already set the following elsewhere
    // to args:
    // _subject,
    if (res.locals.claims) {

      for (const key of fromClaims) {

        if (isString(key) && res.locals.claims.hasOwnProperty(key)) {
          const claim = res.locals.claims[key];
          if (claim === undefined) {
            continue;
          }
          args[key] = claim;
        } else if (isArray(key) && key.length === 2) {
          const [source, alias] = key;
          if (res.locals.claims.hasOwnProperty(source)) {
            const claim = res.locals.claims[source];
            args[alias] = claim;
          }
        }
      }

    }

    if (res.locals._uniqueRequestId) {
      args._uniqueRequestId = res.locals._uniqueRequestId;
    }

    // pass and use only args
    req.args = mapper === null
      ? args
      : await mapper(args);

    // Not perfect, but the best way I know right now to know
    // if data was sent by form (only POST sets the content-type
    // to x-www-form-urlencoded, so that would not catch GET forms)
    const formEncoded = req.get('content-type') !== 'application/json';

    // map magic values for form encoded payloads
    if (formEncoded && hookService) {
      for (let key in req.args) {
        const value = req.args[key];
        req.args[key] = hookService.redux('webFormDecode', value);
        if (req.args[key] === webControllerService._noop) {
          delete req.args[key];
        }
      }
    }

    logger.debug('reduced request args: %o', req.args);

    // save for locals to be used
    res.locals.args = req.args;

    next();

  });

};
