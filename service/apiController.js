const Router = require('express').Router;

const {
  pascalCase,
} = require('change-case');

const {
  type: {
    isString,
    isArray,
  }
} = require('../lib/util')

const {
  consumeArgs,
  useArgs,
  validateArgs,
  viewJSON,
} = require('../lib/middleware');

const {
  Stack,
} = require('../lib/controller');

module.exports = ( ctx ) => {

  const {
    services,
    services: {
      controllerService,
      hookService: {
        redux,
        onRedux,
      },
      routeService: {
        routeInfo: getRouteInfo,
      },
      settingService: {
        getSettings,
      },
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/apiController');

  const [
    appName,
  ] = getSettings([
    'app.name',
  ]);

  onRedux('apiRouteMiddleware', (stack, action, model, routeInfo, method) => {

    const useArgsConfig = redux('useArgs', {}, action, model, method);

    // basic API stack is to gather args from payload,
    // optionally validate, consume the args and return a view.

    stack.set('useArgs', useArgs({
      ...useArgsConfig,
      services,
      logger,
    }));

    const pascalAction = pascalCase(action);

    if (model[`validate${pascalAction}`]) {
      stack.set('validateArgs', validateArgs({
        validator: model[`validate${pascalAction}`],
        logger,
      }));
    }

    stack.set('consumeArgs', consumeArgs({
      consumer: model[action],
      logger,
    }));


    stack.set('viewJSON', viewJSON({
      logger,
    }));

    return stack;

  });

  const apiControllerParams = controllerService.subtypeControllerParams;

  const apiControllerLoadInstance = (loaderCtx, loader, name, actions, config) => {

    if (!name || !isString(name) || !isArray(actions)) {
      return null;
    }

    const {
      models: loadedModels,
    } = loaderCtx;

    const modelName = `${name}Model`;

    if (!loadedModels[modelName]) {
      logger.warn("%s is not a registered model. Skipping", modelName);
      return null;
    }

    const model = loadedModels[modelName];

    const router = Router();

    const addedRouteIds = {};

    logger.tab();

    actions.forEach((action) => {

      if (!model[action]) {
        logger.warn('%s does not have %s method', modelName, action);
        return null;
      }

      const {
        schema = appName,
        entityName,
      } = model._entityInfo || {}

      if (!entityName) {
        logger.warn('_entityInfo.entityName is missing for %s', modelName);
        return null;
      }
      if (!schema) {
        logger.warn('_entityInfo.schema property is missing for %s', modelName);
        return null;
      }

      // TODO: replace with method call to core routeService
      const routeId = `${action}:${schema}.${entityName}`;

      const routeInfo = getRouteInfo(routeId, 'api');

      const {
        uri,
        methods = [],
      } = routeInfo;

      if (!uri || !methods || !methods.length) {
        logger.warn('No api route for route id %s', routeId);
        logger.warn([
          'This is either because the route id is incorrect',
          'or because the route wasn\'t registered with',
          'onRedux(\'apiRoute\', cb) in a service. Defining',
          'a %s table with the %s schema should register the route id for you.',
        ].join(' '), entityName, schema);
        return null;
      }

      const stacks = {};

      for (const method of methods) {

        const stack = redux(
          'apiRouteMiddleware',
          new Stack(),
          action,
          model,
          routeInfo,
          method,
          config
        );

        logger.debug('added %s /api%s', method, uri)

        router[method](uri, stack.middleware());

        stacks[method] = [...stack.middleware()];

      }

      addedRouteIds[routeId] = {
        methods,
        stacks,
      };

    });

    logger.shiftTab();

    onRedux('apiRoute', (nextRoutes) => {
      for (routeId in addedRouteIds) {
        if (!addedRouteIds.hasOwnProperty(routeId)) {
          continue;
        }
        nextRoutes[routeId].enabled = addedRouteIds[routeId].methods;
        nextRoutes[routeId].stacks = addedRouteIds[routeId].stacks;
      }
      return nextRoutes;
    });

    router._nameName = name;
    router._nameType = 'entity';

    return router;

  }

  return {
    apiControllerParams,
    apiControllerLoadInstance,
  };

}
