const {
  cacheResult,
  invalidateCache,
  tryCache,
} = require('../lib/middleware');

const {
  collection: {
    objValueAggregateString,
  },
  type: {
    isString,
    isObject,
    isArray,
  },
} = require('../lib/util');

const makeKey = (prefix, data, keys = []) => {
  if (!keys || !keys.length) {
    return prefix;
  }
  return isObject(data)
    ? `${prefix}_${objValueAggregateString(data, keys)}`
    : `${prefix}_${keys.join(':')}`
};

const redisCacheService = ( ctx = {} ) => {

  const {
    services: {
      hookService,
      redisService,
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/cache');

  const set = async (prefix, data, keys = [], ttl = null) => {
    const key = makeKey(prefix, data, keys);
    const redisArgs = [key];
    if (isObject(data)) {
      redisArgs.push(JSON.stringify(data));
    } else {
      redisArgs.push(data);
    }
    if (ttl) {
      redisArgs.push('ex', ttl);
    }
    return redisService.set(...redisArgs);
  };

  const get = async (prefix, data, keys) => {
    const key = makeKey(prefix, data, keys);
    const json = await redisService.get(key);
    try {
      return JSON.parse(json);
    } catch (error) {
      logger.error('Could not parse cached json. removing key: %o', error);
      remove(key);
    }
  };

  const remove = async (prefix, data, keys) => {
    const key = makeKey(prefix, data, keys);
    return redisService.del(key);
  };

  const removeAll = async (prefix = null) => {
    const lookup = prefix === null
      ? 'result_*'
      : `result_${prefix}_*`;
    const stream = redisService.scanStream({
      match: lookup,
    });
    let numKeys = 0;
    stream.on('data', (keys) => {
      if (keys.length) {
        const pipeline = redisService.pipeline();
        keys.forEach((key) => {
          pipeline.del(key);
        });
        pipeline.exec();
        numKeys += keys.length;
      }
    });
    stream.on('end', () => {
      logger.info(
        'Removed %s keys from %s cache',
        numKeys,
        prefix === null ? 'every' : prefix
      );
    });
  };

  const getPrefixes = () => hookService.redux('cachePrefixes', []);

  let prefixLookup = {};

  const registerPrefix = (prefix) => {
    if (prefixLookup[prefix]) {
      return;
    }
    hookService.onRedux('cachePrefixes', (prefixes) => prefixes.concat(prefix));
    prefixLookup[prefix] = true;
  };

  return {
    get,
    getPrefixes,
    registerPrefix,
    makeKey,
    remove,
    removeAll,
    set,
  };

}

/*
 * TODO: this service was originally designed to be catch all
 * service for any caching but it became clear that a local
 * and remote cache may be desired (remote being something
 * like redis or memcached while local is in-memory and internal
 * to Mazeltov). Ways this could be done:
 * - break this into two services, remoteCache and localCache
 *   (simpler)
 * - revise services to use a container system like Laravel
 *   where services can be produced as instances or singletons
 *   (harder)
 */
module.exports = ( ctx = {} ) => {

  const {
    cacheServiceConfig: config = {},
    services,
    services: {
      hookService,
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/cache');

  const {
    type = 'redis',
  } = config;

  let cacheService;
  switch (type) {
    case 'redis':
      cacheService = redisCacheService(ctx);
      break;
    default:
      throw new Error(`Unrecognized cache service: ${type}`);
  }

  /**
   * Results are cached for 5 minutes by default. You could change
   * this based on the model, action, or method.
   */
  hookService.onRedux('cacheTTL', (_, action, model, method) => {
    return 5 * 60;
  });

  /**
   * BIG TODO: list responses are not cached by default because I am unsure of the
   * best way to invalidate them. For example, if you delete a blog-post this
   * should invalidate a cached search result.
   */
  hookService.onRedux('doesTryCache', (_, action, model, method) => {
    // for any method of get, we try the cache, the exception is an
    // action of 'list' because this hasn't been figured out.
    // 'create' usually doesn't have a result fetched for form
    if (method === 'get') {
      switch (action) {
        case 'create':
        case 'list':
          return false;
        default:
          return true;
      }
    }
    switch (action) {
      case 'get':
        return true;
      default:
        return false;
    }
  });

  hookService.onRedux('doesCacheResult', (_, action, model, method) => {

    if (method === 'get') {
      switch (action) {
        case 'list':
        case 'create':
          return false;
        // for actions update, remove, get is used to populate
        // the form so this makes sense for most actions.
        default:
          return true;
      }
    }

    // otherwise, some actions will cache the result. note that create/update
    // and get all return the fresh, unique record by default.
    switch (action) {
      case 'create':
      case 'update':
        return true;
      default:
        return false;
    }
  });

  // only invalidate cache on remove (create/update write over key instead)
  // this one actually purches the record from cache.
  hookService.onRedux('doesInvalidateCache', (_, action, model, method) => {
    if (method === 'get') {
      return false;
    }
    switch (action) {
      case 'remove':
        return true;
      default:
        return false;
    }
  });

  hookService.onRedux('apiRouteMiddleware', (stack, action, model, routeInfo, method) => {

    const {
      _entityInfo,
    } = model;

    if (!_entityInfo) {
      return stack;
    }

    const {
      key,
      entityName,
    } = _entityInfo;

    const cacheKeys = hookService.redux('cacheKeys', key, action, model);
    const cachePrefix = `result_${entityName}`;

    const {
      methods,
    } = routeInfo;

    const doesTryCache = hookService.redux(
      'doesTryCache',
      false,
      action,
      model,
      method
    );

    if (doesTryCache) {
      stack.before('consumeArgs', 'tryCache', tryCache({
        services,
        prefix: cachePrefix,
        keys: cacheKeys,
        logger,
      }));
    }

    const doesCacheResult = hookService.redux(
      'doesCacheResult',
      false,
      action,
      model,
      method
    );

    const doesInvalidateCache = hookService.redux(
      'doesInvalidateCache',
      false,
      action,
      model,
      method
    );

    if (doesCacheResult) {

      if (doesInvalidateCache) {
        logger.warn([
          'api controller for %s set to cache results and',
          'invalidate afterwards. Revisit any custom hooks to',
          'fix this.',
        ].join(' '), entityName);
      }

      const ttl = hookService.redux('cacheTTL', 0, action, model, method);

      cacheService.registerPrefix(entityName);

      stack.after('consumeArgs', 'cacheResult', cacheResult({
        services,
        prefix: cachePrefix,
        keys: cacheKeys,
        ttl,
        logger,
      }));
    }

    if (doesInvalidateCache) {
      if (doesCacheResult) {
        logger.warn([
          'api controller for %s set to cache results and',
          'invalidate afterwards. Revisit any custom hooks to',
          'fix this.',
        ].join(' '), entityName);
      }
      stack.after('consumeArgs', 'invalidateCache', invalidateCache({
        services,
        prefix: cachePrefix,
        keys: cacheKeys,
        logger,
      }));
    }

    return stack;
  });

  hookService.onRedux('webRenderRouteMiddleware', (stack, action, model, routeInfo) => {

    const {
      _entityInfo,
    } = model;

    if (!_entityInfo) {
      return stack;
    }

    const {
      key,
      entityName,
    } = _entityInfo;

    const cacheKeys = hookService.redux('cacheKeys', key, action, model);
    const cachePrefix = `result_${entityName}`;

    const doesTryCache = hookService.redux('doesTryCache', false, action, model, 'get');

    if (doesTryCache) {
      stack.before('consumeArgs', 'tryCache', tryCache({
        services,
        prefix: cachePrefix,
        keys: cacheKeys,
        logger,
      }));
    }

    const doesCacheResult = hookService.redux('doesCacheResult', false, action, model, 'get');

    if (doesCacheResult) {

      const ttl = hookService.redux('cacheTTL', 0, action, model, 'get');

      cacheService.registerPrefix(entityName);

      stack.set('cacheResult', cacheResult({
        services,
        prefix: cachePrefix,
        keys: cacheKeys,
        ttl,
        logger,
      }));
    }

    return stack;
  });

  hookService.onRedux('webSubmitRouteMiddleware', (stack, action, model, routeInfo) => {

    const {
      _entityInfo,
    } = model;

    if (!_entityInfo) {
      return stack;
    }

    const {
      key,
      entityName,
    } = _entityInfo;

    const cacheKeys = hookService.redux('cacheKeys', key, action, model);
    const cachePrefix = `result_${entityName}`;

    const doesCacheResult = hookService.redux('doesCacheResult', false, action, model, 'post');

    const doesInvalidateCache = hookService.redux('doesInvalidateCache', false, action, model, 'post');

    if (doesCacheResult) {

      if (doesInvalidateCache) {
        logger.warn([
          'api controller for %s set to cache results and',
          'invalidate afterwards. Revisit any custom hooks to',
          'fix this.',
        ].join(' '), entityName);
      }

      const ttl = hookService.redux('cacheTTL', 0, action, model, 'post');

      cacheService.registerPrefix(entityName);

      stack.after('consumeArgs', 'cacheResult', cacheResult({
        services,
        prefix: cachePrefix,
        keys: cacheKeys,
        ttl,
        logger,
      }));
    }

    if (doesInvalidateCache) {
      if (doesCacheResult) {
        logger.warn([
          'api controller for %s set to cache results and',
          'invalidate afterwards. Revisit any custom hooks to',
          'fix this.',
        ].join(' '), entityName);
      }
      stack.after('consumeArgs', 'invalidateCache', invalidateCache({
        services,
        prefix: cachePrefix,
        keys: cacheKeys,
        logger,
      }));
    }

    return stack;

  });

  hookService.onRedux('webRoute', (routes) => ({
    ...routes,
    'manage:cache' : {
      uri: '/admin/cache',
      methods: ['get'],
    },
    'purge:cache' : {
      uri: '/admin/cache/purge',
      methods: ['post'],
    },
  }));

  return cacheService;

};
