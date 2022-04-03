const {
  validate: {
    isNull,
    isNotUndefined,
    isString,
    isOkayIfEither,
    withLabel,
  },
} = require('../../lib/util');

const {
  consumeArgs,
  redirect,
  useArgs,
  validateArgs,
  viewTemplate,
} = require('../../lib/middleware');

const {
  webController,
} = require('../../lib/controller');

module.exports = ( ctx ) => {

  const {
    _requireCSRF,
    _useCSRF,
    models,
    services,
  } = ctx;

  const {
    aclService,
    cacheService,
    hookService,
    modelService: {
      getModels,
    },
    routeService: {
      getRoutes,
    },
  } = services;

  return webController('admin', ctx)
    .get('adminPage', [
      _useCSRF,
      viewTemplate, {
        template: 'admin',
      },
    ])
    .get('manage:route', [
      _useCSRF,
      useArgs, {
        query: [
          'types',
          'isEnabled',
        ],
      },
      consumeArgs, {
        consumerMap: {
          routes: ({ types = null, isEnabled = true }) => {
            return getRoutes(types, isEnabled);
          },
        },
      },
      viewTemplate, {
        template: 'admin/route',
      },
    ])
    .get('manage:model', [
      _useCSRF,
      consumeArgs, {
        consumerMap: {
          models: getModels,
        },
      },
      viewTemplate, {
        template: 'admin/model',
      },
    ])
    .get('manage:hook', [
      _useCSRF,
      useArgs, {
        query: [
          'types',
        ],
      },
      consumeArgs, {
        consumerMap: {
          hooks: hookService.getHooks,
          reducers: hookService.getReducers,
        },
      },
      viewTemplate, {
        template: 'admin/hook',
      },
    ])
    .get('manage:cache', [
      _useCSRF,
      consumeArgs, {
        consumerMap: {
          cachePrefixes: cacheService.getPrefixes,
        },
      },
      viewTemplate, {
        template: 'admin/cache',
      },
    ])
    .post('purge:cache', [
      _requireCSRF,
      _useCSRF,
      useArgs, {
        body: [
          'cachePrefix',
        ],
        errorRedirectURL: 'back',
      },
      validateArgs, {
        cachePrefix: withLabel('Cache', [
          isNotUndefined,
          [
            isOkayIfEither,
            [
              isString,
              isNull
            ],
            'Select a valid cache option'
          ],
        ]),
        errorRedirectURL: 'back',
      },
      consumeArgs, {
        consumer: ({ cachePrefix }) => cacheService.removeAll(cachePrefix),
      },
      redirect, {
        resultFlashMessage: ({ args }) => {
          return args.cachePrefix === null
            ? `All caches have been purged.`
            : `The ${args.cachePrefix} cache has been purged.`;
        },
      },
    ]);

}
