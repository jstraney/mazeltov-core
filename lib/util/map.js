const {
  DateTime
} = require('luxon');

/*
 * A library soley for mapping a value into another.
 * each function should follow the name scheme of
 * xToY so that [].map(xToY) reads like plain language.
 */
const {
  hasKey,
  lookupMap,
  getIfSet,
} = require('./collection');

const {
  trim,
} = require('./string');

const {
  isUndefined,
  isString,
} = require('./type');

const stringToNumber = (str) => {
  return !Number.isNaN(Number.parseFloat(str))
    ? Number.parseFloat(str)
    : 0;
}

const numberToInt = (number) => number - number % 1;
const intToUnsigned = (integer) => integer < 0 ? -integer : integer;
const stringToInt = (str) => numberToInt(stringToNumber(str));
const stringToUnsigned = (str) => intToUnsigned(numberToInt(stringToNumber(str)));

const _boolTrueStrings = lookupMap(['true', 'yes', '1']);
const _boolFalseStrings = lookupMap(['false', 'no', '0']);

// Use this for form encoded data and .env files.
// Not an issue for JSON encoded data.
const stringToBool = (str, defaultValue = null) => {
  const lower = str.toLowerCase()
  if (hasKey(_boolTrueStrings, lower)) {
    return true;
  } else if (hasKey(_boolFalseStrings, lower)) {
    return false;
  } else if (typeof defaultValue === 'boolean') {
    return defaultValue;
  }
  throw new Error(`Cannot map ${str} to a boolean`);
}

const anyToBool = (a) => isString(a) ? stringToBool(a) : new Boolean(a);

const csvRowToArray = (str, delim=',') => str.trim().split(delim).map(trim);
const csvTextToRows = (str, delim='\n') => str.trim().split(delim).map(trim);
const csvTextToMatrix = (str, rowDelim='\n', colDelim=',') => {
  return csvTextToRows(str, rowDelim).map((row) => {
    return csvRowToArray(row, rowDelim);
  });
}

// maps any falsey value to strict null, useful for form encoded
// data which is always a string. (consider that you may want
// to set a date column to null when a date field is empty on
// a form).
const emptyToNull = (value) => value ? value : null

const mapper = (maps = []) => (val) => {

  for (const maybeFn of maps) {
    if (typeof maybeFn !== 'function') {
      throw new TypeError('Array of functions required for mapper');
    }
  }

  return new Promise((resolve, reject) => {

    try {

      const mappedVal = maps.reduce((nextVal, fn) => {

        return fn(nextVal);

      }, val);

      resolve(mappedVal);

    } catch (error) {

      return reject(error);

    }

  });

};

/*
 * Accepts an object with keyed mappers and returns a new
 * function that accepts future objects and maps their values.
 * Can optionally specify to ignore undefined keys on mapped object
 * example:
 * const m = objectMapper({ foo: [ (v) => stringToUnsigned ]})
 * m({foo: '-12.5'});
 * ^ returns {foo: 12}
 */
const objectMapper = ( objMaps = {}, skipUndefined = false ) => {

  // if objMap has arrays of fns, make mappers
  for (const key in objMaps) {
    const val = objMaps[key];
    if (Array.isArray(val)) {
      objMaps[key] = mapper(objMaps[key]);
    } else if (typeof val !== 'function') {
      throw new TypeError([
        'objectMapper requires a function or array of functions',
        'for each key used in the object map',
      ].join(' '));
    }
  }

  return async ( obj = {} ) => {

    return new Promise(async (resolve, reject) => {

      const nextObj = { ...obj };

      try {

        for (const key in objMaps) {

          const value = getIfSet(obj, key);

          if (skipUndefined && isUndefined(value)) {
            continue;
          }

          nextObj[key] = await objMaps[key](value);

        }

      } catch (error) {

        return reject(error);

      }

      resolve(nextObj);

    });

  };

};

const objectToValue = (key, def) => {
  return (elem) => {
    return getIfSet(elem, key, def);
  };
};

module.exports = {
  anyToBool,
  csvRowToArray,
  csvTextToMatrix,
  csvTextToRows,
  emptyToNull,
  intToUnsigned,
  mapper,
  numberToInt,
  objectMapper,
  stringToBool,
  stringToInt,
  stringToNumber,
  stringToUnsigned,
};
