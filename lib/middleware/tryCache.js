const wrap = require('./wrap');

module.exports = ( config = {} ) => {

  const {
    services: {
      cacheService = null,
    },
    prefix = null,
    keys = null,
    logger = global.console,
  } = config;

  [
    [prefix, 'prefix'],
    [keys, 'keys'],
    [cacheService, 'cacheService'],
  ].forEach(([val, label]) => {
    if (!val) {
      throw new Error(`${label} is required for tryResultFromCache. Got ${label}`)
    }
  });

  return wrap(async function tryCache (req, res, next) {

    const {
      args = {},
    } = req;

    const result = await cacheService.get(prefix, args, keys);

    if (result) {
      logger.debug('Cache hit')
      res.locals.result = result;
      res.locals.cacheHit = true;
    } else {
      logger.debug('No cache hit')
    }

    next();
  });
};
