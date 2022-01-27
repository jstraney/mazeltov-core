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

    const {
      _entityInfo = null,
    } = model;

    if (!_entityInfo) {
      return null;
    }

    const {
      key = ['id'],
      entityName,
      listArgs = [],
      createColumns,
      updateColumns,
    } = _entityInfo;

    const hasCompositeKeys = (key).length > 1;

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
            ].concat(listArgs),
          };
        case 'bulkPut':
        case 'bulkRemove':
        case 'bulkCreate':
        case 'bulkMerge':
          return { query: [entityName + 'List'] };
        default:
          return hasCompositeKeys
            ? {
              query: key,
            }
            : {
              params: key,
            };
      }
    }

    switch (action) {
      case 'create':
        return {
          body: createColumns,
        };
      case 'update':
        return hasCompositeKeys
          ? {
            body: key.concat(updateColumns),
          }
          : {
            params: key,
            body: updateColumns,
          };
      case 'bulkPut':
      case 'bulkRemove':
      case 'bulkCreate':
      case 'bulkMerge':
        return { body: [entityName + 'List'] };
      case 'remove':
      case 'softRemove':
      case 'softRestore':
      default:
        return hasCompositeKeys
          ? {
            query: key,
          }
          : {
            params: key,
          };
    }
  });


}
