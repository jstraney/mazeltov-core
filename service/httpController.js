const {
  requireCSRF,
  useCSRF,
} = require('../lib/middleware');

module.exports = ( ctx ) => {

  const {
    services,
    services: {
      hookService,
      routeService: {
        route,
      },
      settingService: {
        getSetting,
      },
    },
    models,
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/httpController');

  hookService.onRedux('staticHttpMiddleware', (last = {}) => ({
    ...last,
    _requireCSRF: requireCSRF({
      authorizedHostname: getSetting('app.hostname'),
      errorRedirectURL: route('signIn') || route('home'),
      logger,
    }),
    _useCSRF: useCSRF({
      logger,
    }),
  }));

  hookService.onRedux('useArgs', (_, action, model, method) => {

    const hasCompositeKeys = model._keys.length > 1;

    if (method === 'get') {
      switch (action) {
        case 'create':
          return {};
        case 'list':
          return {
            query: [
              'createdAtStart',
              'createdAtEnd',
              'updatedAtStart',
              'updatedAtEnd',
              'page',
              'limit',
            ].concat(model._listArgs),
          };
        case 'bulkPut':
        case 'bulkRemove':
        case 'bulkCreate':
        case 'bulkMerge':
          return { query: [model._entityName + 'List'] };
        default:
          return hasCompositeKeys
            ? {
              query: model._keys,
            }
            : {
              params: model._keys,
            };
      }
    }

    switch (action) {
      case 'create':
        return {
          body: model._createColumns,
        };
      case 'update':
        return hasCompositeKeys
          ? {
            body: model._keys.concat(model._updateColumns),
          }
          : {
            params: model._keys,
            body: model._updateColumns,
          };
      case 'bulkPut':
      case 'bulkRemove':
      case 'bulkCreate':
      case 'bulkMerge':
        return { body: [model._entityName + 'List'] };
      case 'remove':
      case 'softRemove':
      case 'softRestore':
      default:
        return hasCompositeKeys
          ? {
            query: model._keys,
          }
          : {
            params: model._keys,
          };
    }
  });


}
