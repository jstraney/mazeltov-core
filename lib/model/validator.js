const {
  pascalCase
} = require('change-case');

const {
  collection: {
    hasAnyKeys,
    peak,
    subObject,
  },
  type: {
    isArray,
    isFunction,
  },
  error: {
    ConflictError,
    ServerError,
  },
  validate: {
    validator,
  },
} = require('../util');

const {
  _joinsAreValid,
  _makeAliasLookup,
  _makeKeys,
  _makeSelectArgs,
  _makeWhere,
  _select,
} = require('./util');

/*
 * Creates a generic validator that can be re-used
 * for various payloads
 */
module.exports = ( ctx = {} ) => {

  const {
    entityInfo,
    logger,
    fnName = 'validate',
    validators = {},
    toValidate = [],
    optional = [],
  } = ctx;

  const {
    entityName,
    pascalEntity = pascalCase(entityName),
    key = ['id'],
  } = ctx;

  // toValidate can accept aliases such as
  // [
  //   'contentId',
  //   ['contentTagsBulkCreate', 'contentTags']
  // ]
  // would use a validator called contentId to check an arg
  // called contentId, but use a validator called contentTagsBulkCreate
  // to validate an arg called contentTags.
  const validatorKeys = toValidate.reduce((arr, name) => {
    return arr.concat(isArray(name) ? name[1] : name);
  }, [])
  .filter((name) => name !== undefined);

  const _validator = subObject(validators, validatorKeys);

  toValidate.forEach((nameMaybeArray) => {
    if (isArray(nameMaybeArray)) {
      const [alias, actual] = nameMaybeArray;
      _validator[actual] = validators[alias];
    }
  });

  // we may want to validate different fields for get,
  // put, delete requests and passing in a separate list
  // of fields to each validator does just that.
  const validateArgs = validator({
    validate: _validator,
    optional,
    collectAll: true,
  });

  const validate = async function ( args = {} ) {

    logger.info('%s %s: %o', fnName, entityName, args);

    const profileId = `${args._uniqueRequestId} ${fnName}${pascalEntity} time`;
    logger.profile(profileId);

    return validateArgs(args);

  };

  if (fnName !== 'validate') {
    Object.defineProperty(validate, 'name', { value: fnName });
  }

  return validate;

};
