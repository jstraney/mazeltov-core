const Router = require('express').Router;

const {
  collection: {
    peak,
  },
  string: {
    noCase,
    pascalCase,
    paramCase,
  },
  type: {
    isObject,
    isFunction,
    isArray,
    isString,
  },
} = require('../lib/util');

const {
  Stack,
} = require('../lib/controller');

const {
  consumeArgs,
  redirect,
  useArgs,
  validateArgs,
  viewJSON,
  useCSRF,
  requireCSRF,
  viewTemplate,
} = require('../lib/middleware');


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
        route,
        routeInfo: getRouteInfo,
      },
      menuService: {
        getMenu,
      },
      settingService: {
        getSettings,
      },
    },
    models,
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/webController');

  /**
   * Switch the validator based on the action and HTTP method
   * for a web based route. (this should usually match the
   * consumer)
   */
  onRedux('webActionValidator', (_, action, model, method) => {

    const pascalAction = pascalCase(action);

    if (method === 'post') {
      return model[`validate${pascalAction}`];
    }

    switch (action) {
      case 'bulkRemove':
      case 'bulkCreate':
      case 'bulkMerge':
      case 'bulkPut':
      case 'merge':
      case 'create':
        return null;
      case 'list':
        return model.validateList || null;
      default:
        return model.validateGet || null;
    }

  });

  /**
   * Return the model method use based on action and HTTP method
   * for a web route.
   */
  onRedux('webActionConsumer', (_, action, model, method) => {

    if (method === 'post') {
      return model[action];
    }

    switch (action) {
      case 'bulkRemove':
      case 'bulkCreate':
      case 'bulkMerge':
      case 'bulkPut':
      case 'merge':
      case 'create':
        return null;
      case 'list':
        return model.list;
      default:
        return model.get;
    }
  });

  const _noop = Symbol('_noop');

  /**
   * This allows certain text values to be magically interpolated
   * to certain JavaScript marshalled values. This is used only for
   * web forms which only deliver string values.
   * API endpoints already expect the application/json content
   * type so this conversion does not happen.
   */
  onRedux('webFormDecode', (value) => {
    /**
     * _none is useful if we want to send a null value via
     * select or checkbox
     *
     * _noop (no operation) is useful to say "ignore this".
     * A unique symbol is used here so the calling redux knows
     * this value can just be removed from args.
     */
    switch (value) {
      case '_none': return null;
      case '_noop': return _noop;
      case '_true': return true;
      case '_false': return false;
      default: return value;
    }
  });

  onRedux('webTemplateArgs', (_, action, model) => {

    const entityName = model._entityName;

    const paramEntity = paramCase(entityName);
    const paramAction = paramCase(action);

    switch (action) {
      case 'create':
        return {
          template: `${paramEntity}/new`,
        };
      case 'update':
        return {
          template: `${paramEntity}/edit`,
          templateOnNoResult: 'error/_404',
        };
      case 'remove':
      case 'softRemove':
        return {
          template: `${paramEntity}/remove`,
          templateOnNoResult: 'error/_404',
        };
      case 'softRestore':
        return {
          template: `${paramEntity}/restore`,
          templateOnNoResult: 'error/_404',
        }
      case 'get':
        return {
          template: `${paramEntity}/view`,
          templateOnNoResult: 'error/_404',
        }
      case 'list':
        return {
          template: `${paramEntity}/index`,
        };
      case 'bulkRemove':
      case 'bulkMerge':
      case 'bulkPut':
      case 'bulkCreate':
      default:
        return {
          template: `${paramEntity}/${paramAction}`,
        };
    }
  });

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

  onRedux('webRenderRouteMiddleware', (stack, action, model, routeInfo) => {

    stack.set('useCSRF', useCSRF({
      errorRedirectURL: 'back',
      queueLength: 5,
      logger,
    }));

    const renderUseArgsConfig = redux('useArgs', null, action, model, 'get');

    if (renderUseArgsConfig) {
      stack.set('useArgs', useArgs({
        ...renderUseArgsConfig,
        services,
        logger,
      }));
    }

    const validator = redux('webActionValidator', null, action, model, 'get');

    if (validator) {
      stack.set('validateArgs', validateArgs({
        validator,
        errorRedirectURL: 'back',
        logger,
      }));
    }

    const consumer = redux('webActionConsumer', null, action, model, 'get');

    if (consumer) {
      stack.set('consumeArgs', consumeArgs({
        consumer,
        logger,
      }));
    }

    const templateArgs = redux('webTemplateArgs', null, action, model);

    if (templateArgs) {
      stack.set('viewTemplate', viewTemplate({
        ...templateArgs,
        logger
      }));
    }

    return stack;

  });

  appSettings = getSettings([
    'app.hostname',
    'app.name',
    'app.port',
    'app.url',
    'app.orgName',
    'app.orgSupportEmail',
    'app.orgSupportPhone',
  ], true);

  onRedux('webSubmitRouteMiddleware', (stack, action, model, routeInfo) => {

    stack.set('requireCSRF', requireCSRF({
      authorizedHostname: appSettings.APP_HOSTNAME,
      errorRedirectURL: route('signIn'),
      logger,
    }));

    stack.set('useCSRF', useCSRF({
      errorRedirectURL: 'back',
      queueLength: 5,
      logger,
    }));

    const submitUseArgsConfig = redux('useArgs', null, action, model, 'post');

    if (submitUseArgsConfig) {
      stack.set('useArgs', useArgs({
        ...submitUseArgsConfig,
        services,
        logger,
      }));
    }

    const validator = redux('webActionValidator', null, action, model, 'post');

    if (validator) {
      stack.set('validateArgs', validateArgs({
        validator,
        errorRedirectURL: 'back',
        logger,
      }));
    }

    const consumer = redux('webActionConsumer', null, action, model, 'post');

    stack.set('consumeArgs', consumeArgs({
      consumer,
      logger,
    }));

    const actionPastTense = action.slice(-1) === 'e'
      ? noCase(action) + 'd'
      : noCase(action) + 'ed';

    const resultFlashMessage = redux(
      'webResultMessage',
      `Your ${noCase(model._entityLabel)} was ${actionPastTense} successfully`,
      action,
      model
    );

    stack.set('redirect', redirect({
      resultFlashMessage,
      errorRedirectURL: 'back',
      logger,
    }));

    return stack;

  });

  onRedux('webGlobalLocals', (locals = {}) => ({
    ...locals,
    ...appSettings,
    NODE_ENV: process.env.NODE_ENV,
    luxon: require('luxon'),
    util: require('../lib/util'),
    basedir: path.resolve(ctx.appRoot, 'view'),
    menu: getMenu,
  }));

  const webControllerParams = controllerService.subtypeControllerParams;

  const webControllerLoadInstance = (loaderCtx, loader, name, actions, config) => {

    // could be the params pulled from the loader's stack was an
    // object, a function or an array and this loader cb shouldn't
    // be used at all, so we return something falsey
    if (!name || !isString(name) || !isArray(actions)) {
      return null;
    }

    const {
      models: loadedModels,
    } = loaderCtx;

    const modelName = `${name}Model`;

    if (!loadedModels[modelName]) {
      logger.warn("%s is not a registered model. Skipping", modelName);
      return;
    }

    const model = loadedModels[modelName];

    const router = Router();

    const addedRouteIds = {};

    actions.forEach((action) => {

      if (!model[action]) {
        return;
      }

      const {
        entityName,
        schema,
      } = model._entityInfo || {};

      const pascalEntity = model._pascalName;
      const pascalAction = pascalCase(action);

      const routeId = `${action}:${schema}.${entityName}`;
      const routeInfo = getRouteInfo(routeId);

      const {
        uri,
        methods,
      } = routeInfo;

      // middlewares for rendering form and for submitting form
      const renderStack = redux(
        'webRenderRouteMiddleware',
        new Stack(),
        action,
        model,
        routeInfo,
        config
      );

      logger.tab();

      logger.debug('added get %s', uri);

      router.get(uri, renderStack.middleware());

      const hasFormPost = methods.includes('post');

      if (hasFormPost) {

        const submitStack = redux(
          'webSubmitRouteMiddleware',
          new Stack(),
          action,
          model,
          routeInfo,
          config
        );

        logger.debug('added post %s', uri);

        router.post(uri, submitStack.middleware());
      }

      logger.shiftTab();

      addedRouteIds[routeId] = methods;

    });

    onRedux('webRoute', (nextRoutes) => {
      for (routeId in addedRouteIds) {
        if (!addedRouteIds.hasOwnProperty(routeId)) {
          continue;
        }
        nextRoutes[routeId].enabled = addedRouteIds[routeId];
      }
      return nextRoutes;
    });

    return router;

  };

  return {
    _noop,
    webControllerParams,
    webControllerLoadInstance,
  };

}
