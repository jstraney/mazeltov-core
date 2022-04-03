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

// wraps a function that accepts ordinal arguments and turns it
// into a kwargs style function with named parameters, the
// argKeys param is an array that should be in order the
// params are normally passed to the function.
const wrapWithArgs = (fn, argKeys) => {
  return ( args = {} ) => {
    // will return undefined if not passed which is as
    // close to the original behavior as is possible.
    const argValues = argkeys.map((key) => args[key]);
    return fn(...argValues);
  };
};

module.exports = {
  curry,
  negateFunc,
  wrapWithArgs,
};
