const
fs   = require('fs'),
path = require('path');

const {
  pascalCase,
} = require('change-case');

const
cliArgs = require('command-line-args'),
cliUsage = require('command-line-usage');

const {
  collection: {
    peak,
  },
  type: {
    isArray,
    isFunction,
    isString,
    isNotArray,
    isObject,
  }
} = require('../lib/util');

const {
  serviceLoader,
} = require('../lib/service');

module.exports = (ctx) => {

  const {
    services: {
      cliControllerService: {
        prepare,
        prepareAndRun,
      },
    },
  } = ctx;

  const loader = serviceLoader('cli', {
    parentType: 'controller',
    pathPrefix: 'controller',
    flat: true,
  });

  return async (ctx, params, dir = null) => {

    const cliControllers = await loader(ctx, params, dir);

    return {
      cliControllers,
      prepare,
      prepareAndRun,
    };

  };

};
