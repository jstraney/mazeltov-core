const wrap = require('./wrap');

module.exports = ( config = {} ) => {

  const {
    services,
    logger = global.console,
  } = config;

  const {
    assetService,
  } = services;

  return wrap(async function preloadAssets (req, res, next) {
    logger.debug('binding asset loader to request and preloading assets');
    res.locals.assets = assetService.bindAssetLoader();
    await res.locals.assets.preloadAll();
    logger.debug('assets finished preloading');
    next();
  });

};
