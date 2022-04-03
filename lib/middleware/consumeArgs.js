const {
  type: {
    isFunction,
    isNotFunction,
  },
  collection: {
    unzip,
    objectLessKeys,
  },
  logic: {
    andArr,
  },
  string: {
    list,
  },
} = require('../util');

const wrap = require('./wrap');

/*
 * Depends on useArgs being used earlier in the middleware chain.
 * Uses consumer to accept and use an object args off of req.
 * The result or error from consumer will be added to the response locals
 */
module.exports = ( config = {} ) => {

  const {
    consumer,
    consumerMap = {},
    redact = [],
    logger = global.console,
  } = config;

  const
  consumerFnList = Object.values(consumerMap),
  consumerKeyList = Object.keys(consumerMap);

  if (!consumer && !andArr(consumerFnList.map(isFunction))) {

    const notFunctions = consumerFnList
      .filter(isNotFunction)
      .map((notFn, i) => `[${i}]:${notFn}`);

    throw new Error([
      'function required for consumerMap option of consumeArgs middleware.',
      'These are not functions', list(notFunctions),
    ].join(' '));

  }

  return wrap(async function consumeArgs (req, res, next) {

    const { args = {} } = req;

    // if we hit the cache, don't bother fetching new results.
    if (res.locals.result && res.locals.cacheHit === true) {
      logger.debug('Cache hit. skipping consumeArgs');
      return next();
    }

    try {

      // use a list of consumers if provided. produces a lookup of
      // results by function name: e.g.
      // {listAccount: {...}, getOpenOrder: {...}}
      if (consumerFnList.length) {

        const result = await Promise.all(consumerFnList.map((fn) => fn(args)));

        res.locals.result = consumerKeyList.reduce((lookup, name, i) => ({
          ...lookup,
          [name]: result[i],
        }), {});

        return next();
      }

      const result = await consumer(args);

      logger.debug('arg consumer result : %o', objectLessKeys(result, redact));

      res.locals.result = result;

    } catch (error) {

      logger.error('Caught error in consumeArgs: %o', error);

      res.locals.error = error;

    }

    next();

  });
}
