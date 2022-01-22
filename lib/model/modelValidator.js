const {
  capitalCase,
} = require('change-case');

const {
  collection: {
    subObject,
  },
  validate: {
    hasMaxLen,
    isBoolean,
    isRequired,
    isString,
    isInteger,
    isUnsigned,
    isNumber,
    validator,
    withLabel,
  },
} = require('../util');

const {
  _mapInternalSchemaType,
} = require('./util');

/*
 * For best interopability, this also can produce a function
 * that returns the validator to be modified if raw is set to true,
 * other wise it produces a validation function that accepts args.
 */
module.exports = ( introspection = {}, raw = false) => {

  const {
    columnInfo: {},
  } = introspection;

  const validators = {};

  const optional = [];

  const columnNames = Object.keys(columnInfo);

  for (const key in columnInfo) {

    const info = columnInfo[key];

    const {
      type,
      maxLength = null,
      nullable = true,
      defaultValue,
    } = info;

    const normalType = _mapInternalSchemaType(type);

    const columnValidators = [];

    if (maxLength !== null) {
      columnValidators.push([hasMaxLen, maxLength]);
    }

    if (!nullable && defaultValue === null) {
      columnValidators.push(isRequired);
    } else {
      optional.push(key);
    }

    if (normalType === 'string') {
      columnValidators.push(isString);
    } else if (normalType === 'integer') {
      columnValidators.push(isInteger);
    } else if (normalType === 'decimal') {
      columnValidators.push(isNumber);
    } else if (normalType === 'boolean') {
      columnValidators.push(isBoolean);
    }

    if (type === 'serial') {
      columnValidators.push(isUnsigned);
    }

    validators[key] = withLabel(capitalCase(key), columnValidators);

  }

  if (raw) {
    return (keys = columnNames) => ({
      validate: subObject(validators, keys),
      optional,
    });
  }

  return validator({
    validate: validators,
    optional,
  });

};
