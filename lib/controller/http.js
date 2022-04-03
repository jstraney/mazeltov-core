const {
  collection: {
    peak,
    subObject,
  },
  type: {
    isArray,
    isFunction,
    isObject,
    isString,
  },
  string: {
    beginsWith,
    pascalCase,
  },
} = require('../util');

const {
  Stack,
} = require('./util');

const Router = require('express').Router;

const httpController = (name, ctx, type = null) => {

  const {
    models,
    services,
    services: {
      hookService: {
        redux,
        onRedux,
      },
      routeService: {
        route: routeUri,
      },
      settingService: {
        getSetting,
      },
    },
    loggerLib,
  } = ctx;

  const appName = getSetting('app.name')

  const logger = isString(type)
    ? loggerLib(`${appName}/controller/http/${name}.${type}`)
    : loggerLib(`${appName}/controller/http/${name}`);

  const slug = isString(type)
    ? `${name}${pascalCase(type)}HttpController`
    : `${name}HttpController`;

  // if you really want to you can modify what is passed globally to middlware
  // producer functions.
  const inheritedCtxProps = redux('middlewareInheritedCtxProps', [
    'services',
    'models',
    'logger',
  ]);

  /**
   * Before the router object is finalized, a redux
   * is called which allows others to hook into the
   * middlewares
   */
  const buildRouter = () => {

    const router = Router();

    const nextUseMap = redux(`${slug}Middleware`, useMap);

    for (const [i, fn] of nextUseMap.getEntries()) {
      router.use(fn);
    }

    const nextRouteMap = redux(`${slug}Routes`, routeMap);

    const addedRouteIds = {};

    for (const [key, stack] of nextRouteMap) {
      const [method, uri] = JSON.parse(key);
      const nextStack = redux(`${slug}RouteMiddleware`, stack, method, uri);
      const nextUri = isString(type)
        ? routeUri(uri, null, type) || uri
        : routeUri(uri, null)       || uri;
      // probably a routeID and not a literal path
      if (!beginsWith(uri, '/') && uri !== nextUri) {
        addedRouteIds[uri] = addedRouteIds[uri] || {};
        addedRouteIds[uri].methods = addedRouteIds[uri].methods || [];
        addedRouteIds[uri].methods.push(method);
        addedRouteIds[uri].stacks = addedRouteIds[uri].stacks || {};
        addedRouteIds[uri].stacks[method] = nextStack.middleware();
      }
      router[method](nextUri, nextStack.middleware());
    }

    // This is a little icky, but allows registering routes as enabled
    // when they are coded manually
    const match = ['api','web'].includes(type);

    if (match) {
      onRedux(`${type}Route`, (nextRoutes) => {
        for (routeId in addedRouteIds) {
          if (!addedRouteIds.hasOwnProperty(routeId)) {
            continue;
          }
          nextRoutes[routeId] = nextRoutes[routeId] || {};
          nextRoutes[routeId].enabled = addedRouteIds[routeId].methods;
          nextRoutes[routeId].stacks = addedRouteIds[routeId].stacks;
        }
        return nextRoutes;
      });
    }

    return router;

  };

  const getRouter = () => router;

  const useMap = new Stack();
  const routeMap = new Map();

  const methods = [
    'all',
    'get',
    'put',
    'patch',
    'post',
    'delete',
    'head',
    'trace',
    'connect',
  ].reduce((iface, method) => ({
    ...iface,
    [method]: (uri, ...args) => {

      const key = JSON.stringify([method, uri]);

      const inheritedCtx = subObject(ctx, inheritedCtxProps);

      const wares = [];
      let drag = 0;
      args.flat().forEach((elem, i) => {

        if (isFunction(elem)) {
          const name = elem.name || `fn${i}`;
          wares.push([ name, elem ]);
          return;
        // can pass an object to extend context
        } else if (isObject(elem)) {
          drag++;
          const fn = wares[i - drag][1]({
            ...inheritedCtx,
            ...elem
          });
          wares[i - drag][1] = fn;
          wares[i - drag][0] = fn.name || `fn${i - drag}`;
          return;
        // can pass true to curry with context (but no
        // splat of passed in config)
        } else if (elem === true) {
          drag++;
          const fn = wares[i - drag][1]({
            ...inheritedCtx
          });
          wares[i - drag][1] = fn;
          wares[i - drag][0] = fn.name || `fn${i - drag}`;
          return;
        } else {
          throw new Error([
            'expected a function or object for controller.',
            `got ${typeof fnOrObject}.`,
          ].join(' '));
        }

      });

      routeMap.set(key, new Stack(wares));

      return self;

    },
  }), {});

  const route = (uri) => {
    // just curry the methods with the URI.
    const nextMethods = {};
    for (const method in methods) {
      nextMethods[method] = methods[method].bind(null, uri);
    }
    return {
      ...nextMethods,
      route,
      use,
      getRouter,
      buildRouter,
    };
  }

  // use gets its own function because it will apply
  // middleware before all routes.
  const use = (...args) => {
    if (isArray(args[0])) {
      args[0].forEach((tuple, i) => {
        if (isArray(tuple)) {
          const [name, fn] = tuple;
          useMap.set(name, fn);
        } else if (isFunction(tuple)) {
          useMap.set(tuple.name || `fn${i}`, tuple);
        }
      });
    }
    return self;
  };

  const self = {
    ...methods,
    route,
    use,
    getRouter,
    buildRouter,
  };

  return self;

}

module.exports = {
  httpController,
};
