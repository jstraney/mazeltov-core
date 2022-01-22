const wrap = require('./wrap');
/**
 * Our flash middleware works a little differently than others
 * instead of storing arrays of typed string messages, the flash
 * can store any local which is combined with locals passed to
 * viewTemplates call to res.render.
 */
module.exports = ( config = {} ) => {

  const {
    logger = global.console,
  } = config;

  return wrap(async function useFlash (req, res, next) {

    if (req.session) {

      req.flash = req.flash || ((key, value) => {

        if (key === 'all' && value === undefined) {

          const flash = req.session.flash || {};

          req.session.flash = {};

          logger.debug('Flushed the flash locals storage: %o', flash);

          return flash;

        } else if (value === undefined) {
          req.session.flash = req.session.flash || {};

          logger.debug('Getting key of %s from flash locals', key);

          return req.session.flash[key] || null;
        }

        logger.debug('Setting %s : %o from flash locals', key, value);
        req.session.flash = req.session.flash || {};
        req.session.flash[key] = value;

      });

      logger.debug('Assigned req.flash helper');

    } else {
      logger.warn('Flash middleware requires a session');
    }

    next();

  });
};
