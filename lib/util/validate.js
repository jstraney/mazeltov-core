const moment = require('moment');

const {
  BadRequestError,
} = require('./error');

const {
  list,
  quote,
  joinWords,
} = require('./string');

const {
  and,
} = require('./logic');

const {
  hasAnyKeys,
  lookupMap,
  objectsPropBoolLookup,
  objectValueSorter,
} = require('./collection');

const {
  isArray: typeIsArray,
  isNotArray: typeIsNotArray,
  isNotBoolean: typeIsNotBoolean,
  isEmpty: typeIsEmpty,
  isNotFunction: typeIsNotFunction,
  isNotInteger: typeIsNotInteger,
  isNull: typeIsNull,
  isNotNull: typeIsNotNull,
  isNotNumber: typeIsNotNumber,
  isNotObject: typeIsNotObject,
  isNotRegexp: typeIsNotRegexp,
  isNotString: typeIsNotString,
  isNotUnsigned: typeIsNotUnsigned,
  isNotUrl: typeIsNotUrl,
  isObject: typeIsObject,
  isUndefined: typeIsUndefined,
} = require('./type')

const hasMinLen = (label = 'Field', min = 1, msg = `${label} must have a minimum length of ${min} characters.`) => (val) => {
  if (val.length < min) {
    throw new BadRequestError(msg);
  }
  return true;
}

const hasMaxLen = (label = 'Field', max = 32, msg = `${label} cannot exceed length of ${max} characters.`) => (val) => {
  if (val.length > max) {
    throw new BadRequestError(msg);
  }
  return true;
}

const hasMinSize = (label = 'Field', min = 1, msg = `${label} must be at least ${min}.`) => (val) => {
  if (val < min) {
    throw new BadRequestError(msg);
  }
  return true;
}

const hasMaxSize = (label = 'Field', max = Number.MAX_SAFE_INTEGER, msg = `${label} cannot exceed ${max}`) => (val) => {
  if (val > max) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isOneOf = (label = 'Field', values = [], msg = `${label} must be one of ${list(values)}`) => (val) => {
  if (!values.includes(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isRegExp = (label='Field', regexp, msg = `${label} is unrecognized`) => {

  if (typeIsNotRegexp(regexp)) {
    throw new Error([
      'isRegexp validator requires regular expression. got',
      typeof regexp,
    ].join(' '));
  }

  return (exp) => {
    if (!regexp.test(exp)) {
      throw new BadRequestError(msg);
    }
    return true;
  }
}

const isEmailExpression = (label='Email', msg = `${label} is unrecognized as an email address.`) => (email) => {
  if (!/[a-zA-Z0-9-_.]+@[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/.test(email)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const doFieldsMatch = (label='Fields', key='field', msg = `${label} must match.`) => (val, { [key]: field }) => {
  if (val !== field) {
    throw new BadRequestError(msg);
  }
  return true;
}

// would detect an unsubmitted form value
const isDefined = (label = 'Field', msg = `${label} is required.`) => (val) => {
  if (val === undefined) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isNull = (label = 'Field', msg = `${label} should be null.`) => (val) => {
  if (typeIsNotNull(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isNotNull = (label = 'Field', msg = `${label} cannot be null.`) => (val) => {
  if (typeIsNull(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isNotEmpty = (label = 'Field', msg = `${label} is required.`) => (val) => {
  if (typeIsEmpty(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isNotUndefined = (label = 'Field', msg = `${label} must be set.`) => (val) => {
  if (typeIsUndefined(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}


const isString = (label = 'Field', msg = `${label} must be a string of characters`) => (val) => {
  if (typeIsNotString(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isBoolean = (label = 'Field', msg = `${label} must be a boolean`) => (val) => {
  if (typeIsNotBoolean(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isNumber = (label = 'Field', msg = `${label} must be a number.`) => (val) => {
  if (typeIsNotNumber(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isInteger = (label = 'Field', msg = `${label} must be an integer.`) => (val) => {
  if (typeIsNotInteger(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isUnsigned = (label = 'Field', msg = `${label} must be a positive integer.`) => (val) => {
  if (typeIsNotUnsigned(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

const isArray = (label = 'Field', msg = `${label} must be an array`) => (val) => {
  if (typeIsNotArray(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

// this checks if a value is an object in the strictest sense of the word
// so no arrays, no fancy classes, just instance of Object
const isObject = (label = 'Field', msg = `${label} must be an array`) => (val) => {
  if (typeIsNotObject(val)) {
    throw new BadRequestError(msg);
  }
  return true;
}

// not useful for form or API data but for code validation (hence normal error).
const isFunction = (label = 'Field', msg = `${label} must be a function`) => (val) => {
  if (typeIsNotFunction(val)) {
    throw new TypeError(msg);
  }
  return true;
}

const isUrl = (label = 'Field', validatorArgs = [], msg = `${label} must be a valid URL`) => (val) => {
  if (typeIsNotUrl(val, ...validatorArgs)) {
    throw new BadRequestError(msg);
  }
  return true;
}

/*
 * See lib.js.model. The iser checks that something IS a valid entity
 * based on the primary key or uniqueColumn tuples.
 * e.g.:
 * isOfEntityType('Message type', messageTypeModel.isMessageType, 'name'),
 */
const isOfEntityType = (label = 'Field', iser = null, key = null, msg = `${label} must be valid`) => {
  if (typeIsNotFunction(iser)) {
    throw new TypeError([
      'isOfEntityType must take function for second parameter. got',
      typeof iser,
    ].join(' '));
  }
  if (typeIsNotString(key)) {
    throw new TypeError([
      'isOfEntityType must take string for third parameter. got',
      typeof key,
    ].join(' '));
  }
  return (val) => {
    // and the rest is history mon ami.
    return iser({ [key]: val });
  };
}

// TODO: evaluate best way to present default error.
// accepts its own validator and throws an error if the validator fails. The validator can accept
// the member object as well as the larger encompassing corpus.
const hasSchema = (label = 'Field', _validator, msg = `${label} must follow a schema`) => async (member, corpus) => {
  if (typeIsNotObject(member)) {
    throw new BadRequestError(msg);
  }
  try {

    await _validator(member, corpus);

    return true;

  } catch (error) {

    throw new BadRequestError(msg);

  }
}

// applies hasSchema over an array
const eachHasSchema = (label = 'Field', validatorArgs, msg = `${label} must be an array with members of a schema`) => {

  // NOTE: passing in the validator itself is deprecated. instead, pass in
  // the validator config (just object). This ternary is for backwards compatibility
  // but should be removed at some major release.
  const _validator = typeIsObject(validatorArgs)
    ? validator(validatorArgs)
    : validatorArgs;

  return async (arr, corpus) => {
    if (typeIsNotArray(arr)) {
      throw new BadRequestError(msg);
    }
    try {

      await Promise.all(arr.map((member) => {
        return _validator(member, corpus);
      }));

      return true;

    } catch (error) {

      throw new BadRequestError(msg);

    }
  };
}

const withLabel = (label = 'Field', validators = []) => {

  /*
    * validators may be passed in as array
    * or just the function (for simpler validators)
    * ...
    * withLabel('Username', [
    *   isNotEmpty,
    *   isString,
    *   [isRegExp, /^[a-z_]{1}[a-z0-9-_.]{,29}/],
    * ])
    */
  return validators.map((elem) => {
    if (typeIsArray(elem)) {
      const [fn, ...args] = elem;
      return fn(label, ...args);
    }
    return elem(label);
  });

}

/*
 * Page and limit are so common that this can be used
 * in validators.
 */
const withPaginators = (minLimit = 1, maxLimit = 64) => {
  return {
    page: withLabel('Page', [
      isUnsigned,
    ]),
    limit: withLabel('Page limit', [
      isUnsigned,
      isNotEmpty,
      [ hasMinSize, minLimit ],
      [ hasMaxSize, maxLimit ],
    ]),
  };
};

const isNumericalMonth = (label = 'Month', msg = `${label} must be a valid two digit month.`) => (val) => {
  const intVal = Number.parseInt(val);
  const outOfRange =  intVal > 12 || intVal < 1;
  if (Number.isNaN(intVal) || val.length < 2 || outOfRange) {
    throw new BadRequestError(msg)
  }
};

const isNumericalDate = (label = 'Date', msg = `${label} must be a valid two digit date.`) => (val) => {
  const intVal = Number.parseInt(val);
  const outOfRange =  intVal > 31 || intVal < 1;
  if (Number.isNaN(intVal) || val.length < 2 || outOfRange) {
    throw new BadRequestError(msg)
  }
};

// the numerical year is presumed to have occured in recent history
// but could be a future year (up to 100 years)! (this may be used for a scheduling year input)
const isNumericalYear = (label = 'Year', msg = `${label} must be a valid four digit year.`) => (val) => {
  const intVal = Number.parseInt(val);
  const outOfRange = intVal < 1900 || intVal > (moment().year() + 100);
  if (Number.isNaN(intVal) || val.length < 4 || outOfRange) {
    throw new BadRequestError(msg)
  }
};

const isNotAfterToday = (config = {}) => (formData = {}) => {

  const {
    label = 'Date',
    msg = `${label} cannot be a future date`,
    monthKey = 'month',
    dayKey = 'day',
    yearKey = 'year',
  } = config;

  const {
    [monthKey]: month = null,
    [dayKey]: day = null,
    [yearKey]: year = null,
  } = formData;

  const date = moment(`${year}-${month}-${day}`, 'YYYY-MM-DD');

  return date.isAfter(moment())
    ? { [yearKey] : [msg] }
    : {};

}

// most commonly used to check 18 years of age
const isNYearsAgo = ( config = {} ) => (formData = {}) => {

  const {
    label = 'Date',
    n = 18,
    msg = `${label} must be ${n} years ago.`,
    monthKey = 'month',
    dayKey = 'day',
    yearKey = 'year',
  } = config;

  const {
    [monthKey]: month = null,
    [dayKey]: day = null,
    [yearKey]: year = null,
  } = formData;

  const date = moment(`${year}-${month}-${day}`, 'YYYY-MM-DD');

  const nYearsAgo = moment().subtract(n, 'years');

  return !date.isSameOrBefore(nYearsAgo)
    ? {[yearKey]: [msg]}
    : {};

}

const isValidDate = ( config = {} ) => (formData = {}) => {

  const {
    label = 'Date',
    msg = `${label} must be a valid date.`,
    monthKey = 'month',
    dayKey = 'day',
    yearKey = 'year',
  } = config;

  const {
    [monthKey]: month = null,
    [dayKey]: day = null,
    [yearKey]: year = null,
  } = formData;

  const date = moment(`${year}-${month}-${day}`, 'YYYY-MM-DD');

  return !date.isValid()
    ? {[yearKey]: [msg]}
    : {};

}

const checkLuhn = (label = 'Credit card', msg = `${label} must be valid.`) => (val) => {

  // remove all non digit characters
  const valNormal = val.replace(/\D/g, '');

  let sum = 0;
  let shouldDouble = false;

  // loop through values starting at the rightmost side
  for (let i = valNormal.length - 1; i >= 0; i--) {

    let digit = parseInt(valNormal.charAt(i));

    if (shouldDouble) {
      if ((digit *= 2) > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  if ((sum % 10) != 0) {
    throw new BadRequestError(msg);
  }

}

const validatorErrorSorter = objectValueSorter('key');

const validator = ( config = {} ) => {

  /**
   * TODO: the original API was to pass an object called
   * validate with the field keys and validators for each.
   *
   * Since then, it seems simpler to just use splat and any
   * non-special config will be treated as a field.
   *
   * I am considering deprecating the "validate" property
   * but thinking of keeping it because it allows a developer
   * to use field names like "optional" or "collectAll"
   *
   * Also deprecating things is hard.
   */
  const {
    validate: oldWayToPassValidate = {},
    optional = [],
    collectAll = false,
    logger = global.console,
    ...restValidate
  } = config;

  const validate = {
    ...oldWayToPassValidate,
    ...restValidate
  };

  // map of optional arg names so that lookup is O(1)
  const optionalLookup = lookupMap(optional);

  return ( args = {} ) => {

    return new Promise(async (resolve, reject) => {

      if (typeIsNotObject(args)) {
        return reject(new BadRequestError('Validator must be passed an object'));
      }

      const errors = [];

      for (const key in validate) {

        const validators = validate[key];

        const value = args[key];

        if (value === undefined && optionalLookup[key]) {
          continue;
        }

        for (const _validator of validators) {

          try {

            await _validator(value, args);

          } catch (error) {

            errors.push({
              key,
              message: error.message,
            });

            if (collectAll) {
              continue;
            } else {
              const err = new BadRequestError('An item requires fixing', errors);
              err.list = errors;
              err.lookup = objectsPropBoolLookup(errors, 'key');
              return reject(err);
            }

          }

        }

      };

      if (collectAll && errors.length) {
        const err = new BadRequestError('One or more items need fixing', errors);
        err.list = errors.sort(validatorErrorSorter);
        err.lookup = objectsPropBoolLookup(errors, 'key');
        return reject(err);
      }

      resolve(true);

    });

  };

}

// passes validator if even one is okay without error
const isOkayIfEither = (label = 'Field', cbs = [], msg=`${label} must be one of:`) => {

  return async (value) => {
    const errorList = [];
    for (const cb of cbs) {
      try {
        await cb(value);

        return true;
      } catch (error) {
        errorList.push(error);
        continue;
      }
    }

    // only throw errors if not a single thing passed.
    if (errorList.length) {
      throw new BadRequestError(msg, list);
    }
  };

};

const isJSON = (label = 'Field', msg=`${label} must be valid JSON`) => (value) => {
  try {
    JSON.parse(value)
  } catch (error) {
    throw new BadRequestError(msg);
  }
  return true;
};

// next two helpers are so you don't have to tirelessly pair NotEmpty
// with isString/isUnsigned
const isSerial = (...args) => {
  const curriedChecks = (v) => and(isNotEmpty(...args), isUnsigned(...args));
  return (value) => {
    curriedChecks(value);
    return true;
  };
};

const isIdString = (...args) => {
  const curriedChecks = (v) => and(isNotEmpty(...args), isString(...args));
  return (value) => {
    curriedChecks(value);
    return true;
  };
};

module.exports = {
  hasMaxSize,
  hasMinSize,
  hasMinLen,
  hasMaxLen,
  isOneOf,
  isRegExp,
  isEmailExpression,
  isOkayIfEither,
  doFieldsMatch,
  isDefined,
  isNotNull,
  isNotEmpty,
  isString,
  isBoolean,
  isNumber,
  isInteger,
  isUnsigned,
  isNull,
  isArray,
  isJSON,
  isObject,
  isUrl,
  isFunction,
  isSerial,
  isIdString,
  hasSchema,
  eachHasSchema,
  withLabel,
  withPaginators,
  isNumericalMonth,
  isNumericalDate,
  isNumericalYear,
  isNotAfterToday,
  isNYearsAgo,
  isOfEntityType,
  isNotUndefined,
  isValidDate,
  checkLuhn,
  validator,
};
