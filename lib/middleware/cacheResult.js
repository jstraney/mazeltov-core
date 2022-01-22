const wrap = require('./wrap');

/**
 * Insert this middleware after consumeArgs. This would
 * allow you to cache the results after the consumer produces
 * them. This only sets the cache for future use on the next
 * request.
 */
module.exports = ( config = {} ) => {

  const {
    services: {
      cacheService = null,
    },
    prefix = null,
    ttl = null,
    keys = null,
  } = config;

  [
    [prefix, 'prefix'],
    [keys, 'keys'],
    [ttl, 'ttl'],
    [cacheService, 'cacheService'],
  ].forEach(([val, label]) => {
    if (!val) {
      throw new Error(`${label} is required for tryResultFromCache. Got ${label}`)
    }
  });

  return wrap(async function cacheResult (req, res, next) {

    const result = res.locals.result;

    if (res.locals.cacheHit !== true && result) {
      await cacheService.set(prefix, result, keys, ttl);
      logger.debug('Results cached');
    } else {
      logger.debug('No results to cache');
    }

    next();

  });
};
