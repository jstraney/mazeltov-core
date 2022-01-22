const {
  collection: {
    peak,
  },
  type: {
    isArray,
    isFunction,
    isObject,
  },
  string: {
    beginsWith,
  },
} = require('../../../util');

const {
  Stack,
} = require('./util');

const Router = require('express').Router;

const httpController = (name, ctx) => {

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
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib(`${ctx.SERVICE_NAME}/controller/http/${name}`);

  /**
   * Before the router object is finalized, a redux
   * is called which allows others to hook into the
   * middlewares
   */
  const buildRouter = () => {

    const router = Router();

    const nextUseMap = redux(`${name}HttpControllerMiddleware`, useMap);

    for (const [i, fn] of nextUseMap.getEntries()) {
      router.use(fn);
    }

    const nextRouteMap = redux(`${name}HttpControllerRoutes`, routeMap);

    const addedRouteIds = {};

    for (const [key, stack] of nextRouteMap) {
      const [method, uri] = JSON.parse(key);
      const nextStack = redux(`${name}HttpControllerRouteMiddleware`, stack, method, uri);
      const nextUri = routeUri(uri) || uri;
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
    const match = /(Api|Web)$/.exec(name);

    if (match !== null) {
      const [ routeType ] = match;
      onRedux(`${routeType.toLowerCase()}Route`, (nextRoutes) => {
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

      const wares = [];
      let drag = 0;
      args.flat().forEach((fnOrObject, i) => {

        if (isFunction(fnOrObject)) {
          const name = fnOrObject.name || `fn${i}`;
          wares.push([ name, fnOrObject ]);
          return;
        } else if (isObject(fnOrObject)) {
          drag++;
          wares[i - drag][1] = wares[i - drag][1]({
            ...fnOrObject,
            services,
            models,
            logger,
          });
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
