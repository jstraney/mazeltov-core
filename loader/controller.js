const {
  serviceLoader,
} = require('../lib/service');

module.exports = () => serviceLoader('controller');
