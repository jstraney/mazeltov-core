const {
  string: {
    beginsWith,
    paramCase,
    sentenceCase,
    pluralize,
    objFromQuery,
    fmtPlaceholder,
  },
  collection: {
    arrayIntersect,
    peak,
    cross,
  },
} = require('../lib/util');

/**
 * The route service is the foundation to register under programatic ids:
 * - A URI
 * - A label
 * - ACLs
 * The routes do not necessarily need to be HTTP and could be
 * for other protocols or interfaces (cli, amqp, udp) so long
 * as a controller exists to use these routes.
 */
module.exports = async ( ctx = {} ) => {

  const {
    services: {
      hookService,
      modelService,
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/route');

  hookService.onRedux('apiRouteUri', (_, action, entityInfo) => {

    const hasCompositeKey = entityInfo.key.length > 1;

    const entityName = entityInfo.entityName;

    const defaultRoute = hasCompositeKey
      ? `/${entityName}`
      : `/${entityName}/:${peak(entityInfo.key)}`;

    switch (action) {
      case 'create':
        return `/${entityName}`;
      case 'list':
        return `/${entityName}/list`;
      case 'bulkMerge':
        return `/${entityName}/bulk/merge`;
      case 'bulkPut':
        return `/${entityName}/bulk/put`;
      case 'bulkCreate':
        return `/${entityName}/bulk/create`;
      case 'bulkRemove':
        return `/${entityName}/bulk/remove`;
      case 'get':
      case 'merge':
      case 'update':
      case 'remove':
      case 'softRemove':
      case 'softRestore':
      default:
        return defaultRoute;
    }

  });

  /**
   * Return the HTTP method for an API action
   */
  hookService.onRedux('apiActionMethod', (_, action) => {
    switch (action) {
      case 'create':
      case 'softRestore':
      case 'bulkCreate':
        return 'post';
      case 'update':
        return 'patch';
      case 'merge':
      case 'bulkMerge':
      case 'bulkPut':
        return 'put';
      case 'remove':
      case 'bulkRemove':
      case 'softRemove':
        return 'delete';
      case 'get':
      case 'list':
      default:
        return 'get';
    }
  });

  /**
   * Used when building web routes to create an
   * alternative route with post method for form
   * submission. Most actions have a POST route for
   * form submission, the exception usually the get
   * and list method of a model (which most forms use
   * GET) Note that HTML spec doesn't support plain HTML
   * form methods other than GET or POST.
   */
  hookService.onRedux('webActionHasPost', (hasPost, action, model) => {
    switch (action) {
      case 'get':
      case 'list':
        return false;
      default:
        return true;
    }
  });

  hookService.onRedux('routeLabel', ( action, model) => {

    const {
      _entityInfo = null,
    } = model;

    if (!_entityInfo) {
      return;
    }

    const {
      entityName,
      entityLabel = sentenceCase(entityName),
      entityLabelPlural = pluralize(entityLabel),
    } = _entityInfo;

    switch (action) {
      case 'create':
        return `New ${entityLabel}`;
      case 'list':
        return entityLabelPlural;
      case 'bulkUpdate':
      case 'bulkMerge':
      case 'bulkPut':
        return `Edit ${entityLabelPlural}`;
        return `/${entityName}/bulk/put`;
      case 'bulkCreate':
        return `New ${entityLabelPlural}`;
      case 'bulkRemove':
        return `Remove ${entityLabelPlural}`;
      case 'get':
        return `View ${entityLabel}`;
      case 'merge':
      case 'update':
        return `Edit ${entityLabel}`;
      case 'remove':
      case 'softRemove':
        return `Remove ${entityLabel}`;
      case 'softRestore':
        return `Restore ${entityLabel}`;
      default:
        return sentenceCase(`${action} ${entityLabel}`);
    }

  });

  const buildRouteId = (action, entityName) => {
    return `${action}:${entityName}`;
  }

  hookService.onRedux('webRouteUri', (_, action, entityInfo) => {

    const routeBase = `/${paramCase(entityInfo.entityName)}`;

    const routeBasePlural = `/${paramCase(entityInfo.entityNamePlural)}`;

    const hasCompositeKey = entityInfo.key.length > 1;

    const entityName = entityInfo.entityName;

    const paramAction = paramCase(action);

    const defaultRoute = hasCompositeKey
      ? routeBase
      : `${routeBase}/:${peak(entityInfo.key)}`;

    switch (action) {
      case 'create':
        return `/${entityName}/new`;
      case 'list':
        return routeBasePlural;
      case 'get':
        return `${defaultRoute}`;
      case 'update':
        return `${defaultRoute}/edit`;
      case 'remove':
        return `${defaultRoute}/remove`;
      case 'bulkRemove':
      case 'bulkMerge':
      case 'bulkCreate':
      case 'bulkPut':
        return `${defaultRoute}/${paramAction}`;
      default:
        return `${defaultRoute}/${paramAction}`;
    }

  });

  hookService.onRedux('apiRoute', () => {
    const routes = {};
    const actions = modelService.getEntityActions();
    const allEntityInfo = modelService.getEntityInfo();
    for (const fullName in allEntityInfo) {
      const entityInfo = allEntityInfo[fullName];
      for (const action in actions) {
        const actionInfo = actions[action];
        if (!arrayIntersect(actionInfo.controller, ['http', 'api']).length) {
          continue;
        }
        const id = buildRouteId(action, fullName);
        const uri = hookService.redux('apiRouteUri', null, action, entityInfo);
        const method = hookService.redux('apiActionMethod', null, action);
        routes[id] = {
          uri,
          methods: [method],
        };
      }
    }
    return routes;
  });

  hookService.onRedux('cliRouteUri', (uri, action, entityInfo) => {
    const {
      entityName,
    } = entityInfo;
    return `${entityName} ${action}`;
  });

  hookService.onRedux('cliRoute', () => {
    const routes = {};
    const actions = modelService.getEntityActions();
    const allEntityInfo = modelService.getEntityInfo();
    for (const fullName in allEntityInfo) {
      const entityInfo = allEntityInfo[fullName];
      for (const action in actions) {
        const actionInfo = actions[action];
        if (!arrayIntersect(actionInfo.controller, ['cli']).length) {
          continue;
        }
        const id = buildRouteId(action, fullName);
        const uri = hookService.redux('cliRouteUri', null, action, entityInfo);
        const options = hookService.redux('cliOptions', [], action, entityInfo);
        const help = hookService.redux('cliHelp', [], action, entityInfo, options);
        routes[id] = {
          uri,
          help,
          options,
        };
      }
    }
    return routes;
  });

  hookService.onRedux('webRoute', () => {
    const routes = {
      home: {
        uri: '/',
        methods: ['get'],
      },
      adminPage: {
        uri: '/admin',
        methods: ['get'],
      },
      'manage:route': {
        uri: '/admin/routes',
        methods: ['get'],
      },
      'manage:model': {
        uri: '/admin/models',
        methods: ['get'],
      },
    };
    const actions = modelService.getEntityActions();
    const allEntityInfo = modelService.getEntityInfo();
    for (const fullName in allEntityInfo) {
      const entityInfo = allEntityInfo[fullName];
      for (const action in actions) {
        const actionInfo = actions[action];
        if (!arrayIntersect(actionInfo.controller, ['http', 'web']).length) {
          continue;
        }
        const id = buildRouteId(action, fullName);
        const uri = hookService.redux('webRouteUri', null, action, entityInfo);
        const hasPost = hookService.redux('webActionHasPost', true, action);
        routes[id] = {
          uri,
          methods: hasPost ? ['get', 'post'] : ['get'],
        };
      }
    }
    return routes;
  });

  /**
   * This will take a URL decorated with params and query string
   * and will return a flattened object of which params are bound
   * to the URL.
   * e.g.: /person/3?example=12
   * becomes: { id : 3, example: 12 }
   * NOTE: the implementation MUST NEVER allow something like this
   * to work
   * e.g.: /person/3?id=12
   * producing: { id: 12 }
   * This is why the path placeholders are retrieved later which
   * should overwrite anything passed by querystring, but we do
   * want to allow query string params because some resources use
   * identifiers in the query string.
   */
  const getParamsFromUrl = (uri, id) => {
    // start with query params which are not officially supported
    // as part of registered routes. (only passed at request time)
    const [uriPath, querystr] = uri.split('?');
    const params = !querystr
      ? {}
      : objFromQuery(querystr);
    // now diff the uri path with the original (with :var placeholders)
    const orig = routeUri(id) || id;
    const uriPathParts = uriPath.split('/');
    return orig.split('/').reduce((next, part, i) => {
      if (/^:/.test(part)) {
        const key = part.slice(1);
        const val = uriPathParts[i];
        return {
          ...next,
          [key]: val
        };
      }
      return next;
    }, params);
  };

  const routeInfo = (id, controller = 'web') => {
    return hookService.redux(`${controller}Route`, {})[id] || {};
  };

  const routeUri = (id, params, controller = 'web') => {
    const uri = routeInfo(id, controller).uri
    return uri
      ? fmtPlaceholder(uri, params || {})
      : null;
  };

  const routeMethods = (id, controller = 'web') => {
    return routeInfo(id, controller).methods || [];
  };

  const registerRoutes = (nextRoutes = {}, type='web') => {
    hookService.onRedux(`${type}Route`, (routes = {}) => ({
      ...routes,
      ...nextRoutes
    }));
  };

  const getRoutes = (types = ['web', 'api', 'cli'], isEnabled = null) => {
    if (!types) {
      types = ['web', 'api', 'cli'];
    }
    return types.reduce((routes, type) => {

      const controllerRoutes = { ...hookService.redux(`${type}Route`, {}) }

      if (isEnabled !== null) {
        for (const routeId in controllerRoutes) {
          if (!controllerRoutes.hasOwnProperty(routeId)) {
            continue;
          }
          if (isEnabled === false && controllerRoutes[routeId].enabled) {
            delete controllerRoutes[routeId];
          } else if (isEnabled === true && !controllerRoutes[routeId].enabled) {
            delete controllerRoutes[routeId];
          }
        }
      }

      return {
        ...routes,
        [type]: controllerRoutes,
      };
    }, {});
  };


  return {
    registerRoutes,
    routeInfo,
    routeUri,
    buildRouteId,
    route: routeUri,
    routeMethods,
    getParamsFromUrl,
    getRoutes,
  };

};
