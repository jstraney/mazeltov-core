const {
  serviceLoader,
} = require('../lib/service');

module.exports = () => serviceLoader('repository');
