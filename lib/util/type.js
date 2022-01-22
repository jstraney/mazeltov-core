/*
 * A type checking library that does not throw errors and simply
 * returns booleans
 * the validate library uses this library but throws errors.
 * The usefulness of all this is to have a functional equivalent
 * of the procedural idiom which allows the function to be passed
 * into map, reduce, filter, among others. iow, the procederal
 * patterns cannot be reused as easily.
 */

const isRegexp = (val) => {
  return typeof val === 'object'
    && val  instanceof RegExp;
};

/*
 * Checks if true object
 */
const isObject = (val) => {
  return val !== null
    && typeof val === 'object'
    && val.constructor === Object
};

const isString    = (val) => typeof val === 'string';
const isBoolean   = (val) => typeof val === 'boolean';
const isNumber    = (val) => !Number.isNaN(Number.parseInt(val));
const isInteger   = (val) => isNumber(val) && (val % 1 === 0);
const isUnsigned  = (val) => isInteger(val) && val >= 0;
const isFunction  = (val) => typeof val === 'function';
const isArray     = (val) => Array.isArray(val);
const isNull      = (val) => val === null;
const isUndefined = (val) => val === undefined;
const isEmpty     = (val) => !val;

// This is a super simple validator
const isUrl = (val, schemes = ['https']) => {
  const exp = new RegExp(`^(?:${schemes.join('|')})://[\\S]+$`);
  return exp.test(val);
};

/*
 * Now we build negations. Why? why not simply prepend ! before
 * calling the function? You're thinking imperatively and not
 * declaratively. What if you wanted to do something like this?
 * if (andArr(values.map(isNotEmpty))) {
 *   // do something if all array values are not empty
 * }
 */
const negations = [
  isArray,
  isBoolean,
  isFunction,
  isInteger,
  isNumber,
  isObject,
  isRegexp,
  isString,
  isUnsigned,
  isNull,
  isUndefined,
  isUrl,
  isEmpty,
].reduce((o, fn) => ({
  ...o,
  // note that ./func.negateFunc is not used because it would cause
  // a circular dependency ** sigh **
  ['isNot' + fn.name.slice(2)]: (...args) => !fn(...args),
}), {});

module.exports = {
  ...negations,
  isArray,
  isBoolean,
  isFunction,
  isInteger,
  isNumber,
  isObject,
  isRegexp,
  isString,
  isUnsigned,
  isEmpty,
  isNull,
  isUndefined,
};
