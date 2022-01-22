const {
  isArray,
  isString,
  isNotEmpty,
} = require('./type');

// KNOWN ISSUE: some common names are three tokens long
// (for instance example.co.uk is actually a CN), this doesn't
// handle this for the time being. Maybe a list of zones like this
// could be used to handle these edge cases.
const getCommonName = (fqdn = '') => fqdn.split('.').slice(-2).join('.');

const hasCommonName = (fqdn = '', cn = '') => {
  return getCommonName(fqdn) === cn;
};

const getDomainTokens = (name) => {
  return name.trim().split('.').filter(isNotEmpty);
};

const getDomainMoniker = (name) => {

  const tokens = getDomainTokens(name);

  return tokens.length > 1
    ? tokens.slice(0, -1).join('.')
    : name;

}

const isNameOfNTokens = (name, length = 1) => {
  if (isArray(name) && name.length === length) {
    return true;
  } else if (isString(name) && getDomainTokens(name).length === length) {
    return true;
  }
  return false;
}

const getTld = (name) => getDomainTokens(name).pop();

/*
 * Accepts a domain string, or an array of domain tokens
 */
const isSubdomain = (name) => isNameOfNTokens(name, 3);

const isCommonName = (name) => isNameOfNTokens(name, 2);

module.exports = {
  getCommonName,
  hasCommonName,
  getDomainTokens,
  getDomainMoniker,
  getTld,
  isNameOfNTokens,
  isCommonName,
  isSubdomain,
};
