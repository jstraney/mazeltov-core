const wrap = require('./wrap');

/**
 * This invalidates a cache entry by removing it. This
 * is commonly used by DELETE requests
 */
module.exports = ( config = {} ) => {

  const {
    services: {
      cacheService = null,
    },
    prefix = null,
    keys = null,
    logger = console.logger,
  } = config;

  [
    [prefix, 'prefix'],
    [keys, 'keys'],
    [cacheService, 'cacheService'],
  ].forEach(([val, label]) => {
    if (!val) {
      throw new Error(`${label} is required for invalidateCacheResult. Got ${label}`)
    }
  });

  return wrap(async function invalidateCache (req, res, next) {

    const {
      args = {},
    } = req;

    await cacheService.remove(prefix, args, keys);

    logger.debug('Cache invalidated');

    next();
  });

};
