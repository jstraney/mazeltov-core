const {
  normalizeError,
} = require('./errorHandlers');

module.exports = (fn, name) => {

  const nextFn = async function (req, res, next) {

    return fn.length === 3
      ? fn(req, res, next).catch((err) => next(normalizeError(err)))
      : fn(req, res).catch((err) => next(normalizeError(err)));

  };

  Object.defineProperty(nextFn, 'name', { value: fn.name || name });

  return nextFn;

};
