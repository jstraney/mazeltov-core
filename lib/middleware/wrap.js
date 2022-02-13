const {
  normalizeError,
} = require('./errorHandlers');

module.exports = (fn, name) => {


  const nextFn = async function (req, res, next) {

    const handle = (err) => {
      console.error('Unhandled error %o', err);
      next(normalizeError(err));
    };

    return fn.length === 3
      ? fn(req, res, next).catch(handle)
      : fn(req, res).catch(handle);

  };

  Object.defineProperty(nextFn, 'name', { value: fn.name || name });

  return nextFn;

};
