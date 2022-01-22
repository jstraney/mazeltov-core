const {
  collection: {
    hasKey,
  },
} = require('../util');

const wrap = require('./wrap');

/*
 * Set one or more arg to the browser cookie. This is useful for tokens
 * and identifiers that may get passed through a link (like an
 * affiliate token).
 */
module.exports = ( config = {} ) => {

  const {
    args: argKeys = [],
    prefix = '',
    maxAge,
    httpOnly = true,
    secure = true,
    signed = true,
    logger = global.console,
  } = config;

  return wrap(async function setArgToCookie (req, res, next) {

    if (!req.cookies) {

      logger.warn([
        'cookie-parser middleware doesn\'t look like its getting',
        'used. This will not allow setArgToCookie middleware to',
        'work as expected.',
      ].join(' '))

      return next();

    }

    const {
      args = {},
    } = req;

    for (const key of argKeys) {

      const cookieKey = `${prefix}${key}`;

      if (hasKey(req.cookies, key)) {
        continue;
      }

      if (hasKey(args, key)) {

        res.cookie(cookieKey, args[key], {
          maxAge,
          secure,
          httpOnly,
          signed,
        });

      }

    }

    next();

  });

};
