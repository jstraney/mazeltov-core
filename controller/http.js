const fs = require('fs');
const path = require('path');

const Router = require('express').Router;

const {
  pascalCase,
} = require('change-case')

const {
  Stack,
} = require('../lib/controller');

const {
  serviceLoader,
} = require('../lib/service');

const {
  type: {
    isArray,
    isNotArray,
    isFunction,
    isObject,
  },
} = require('../lib/util');


module.exports = (ctx) => {

  const loader = serviceLoader('http', {
    parentType: 'controller',
    pathPrefix: 'controller',
    toArray: true,
  });

  loader.apiRouters = serviceLoader('api', {
    parentType: 'controller',
    pathPrefix: 'controller',
    toArray: true,
  });

  loader.webRouters = serviceLoader('web', {
    parentType: 'controller',
    pathPrefix: 'controller',
    toArray: true,
  });

  return loader;

};
