const {
  collection: {
    lookupMap,
    hasKey,
  },
  rand: {
    randStr,
  },
} = require('../util');

const wrap = require('./wrap');

module.exports = ( config = {} ) => {

  const {
    skipMethods = ['head', 'options'],
    logger = global.console,
  } = config;

  const normalizedMethods = Array(skipMethods.length * 2)

  skipMethods.forEach((method) => {
    normalizedMethods.push(method.toLowerCase());
    normalizedMethods.push(method.toUpperCase());
  });

  const skipMethodMap = lookupMap(normalizedMethods);

  return wrap(async function requestLogger (req, res, next) {

    if (hasKey(skipMethodMap, req.method)) {
      return next();
    }

    res.locals._uniqueRequestId = randStr(16, 'base64');

    logger.info("%s %s %s %s %s",
      res.locals._uniqueRequestId,
      req.ip,
      req.protocol,
      req.method,
      req.originalUrl,
    );

    next();

  });

};
