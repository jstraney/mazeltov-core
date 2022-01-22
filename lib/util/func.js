const {
  isArray,
  isNotArray,
  isFunction,
} = require('./type');

/*
 * function curry.
 */
const curry = (fn, ...args) => {
  return (...nextArgs) => {
    return fn(...args, ...nextArgs);
  };
};

// curry an array of functions
const curryArray = (params, arr) => {

  if (isNotArray(arr)) {
    throw new TypeError('array needed for arg 2 of curryArray');
  }
  if (arr.filter(isFunction) !== arr.length) {
    throw new TypeError('arg 2 of curryArray needs to be array of functions');
  }

  return isArray(params)
    ? arr.map((fn) => curry(fn, ...params))
    : arr.map((fn) => curry(fn, params));

};

const negateFunc = (fn) => (...args) => !fn(...args);

module.exports = {
  curry,
  negateFunc,
};
