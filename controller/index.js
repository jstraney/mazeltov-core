const fs = require('fs');
const path = require('path');

const {
  serviceLoader,
} = require('../lib/service');

module.exports = serviceLoader('controller');

/*
// TODO: I figured it out, what makes controllers so
// complicated is that there are n "types" of controller
// and each type has m "resources" (a model is a model
// is a model with only n "resources")
// Each "kind" of controller should actually use its own
// loader. The loader interface may want some redux used.
// The hook service may need to be strapped before other services
// are loaded...
module.exports = serviceExporter([
  'http',
  'web',
  'api',
  'cli'
], 'controller', __dirname);
*/
