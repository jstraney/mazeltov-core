const fs = require('fs').promises;

const path = require('path');

const uglify = require('uglify-js');

const {
  collection: {
    arrayIntersect,
  },
  type: {
    isArray,
  },
} = require('../lib/util');

/**
 * The asset service allows other modules to register
 * their own client side scripts and links which can
 * be embeded in header conditionally and cache-busted
 */
module.exports = ( ctx = {} ) => {

  const {
    services: {
      hookService,
    },
    NODE_ENV,
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/asset');

  const baseAssetContent = {
    script: {},
    style: {},
  };

  hookService.onRedux('assetTypeList', (list) => [
    ...list,
    'script',
    'style',
  ]);

  hookService.onRedux('assetType', (_, path) => {
    if (/\.js$/.test(path)) {
      return 'script';
    }
    if (/\.css$/.test(path)) {
      return 'style';
    }
  });

  /**
   * TODO: implement transformers that pipeline output at run-time
   *
   * transform assets before outputing them (allowing CSS transpilers and
   * minifiers to be run before initial load.
   */
  hookService.onRedux('assetTransformer', (_, path, content, type) => {
    // don't minify already minified js by default!
    if (/\.min\.js$/.test(path)) {
      return [];
    } else if (/\.js$/.test(path)) {
      return [uglify.minify];
    }
    return [];
  });

  const registerAsset = (name, path) => {

    const content = fs.readFile(path, { encoding : 'utf8' });

    const type = hookService.redux('assetType', null, path);

    if (type === null) {
      return false;
    }

    hookService.onRedux(`asset`, (assetContent) => ({
      ...assetContent,
      [type] : {
        ...(assetContent[type] || {}),
        [name]: NODE_ENV === 'development'
          ? fs.readFile(path, { encoding: 'utf8' })
          : content,
      }
    }));

  };

  let assetTypes;

  // Binds an asset loader to the request. Each request returns
  // a function bound to it's own context of fetched assets
  const bindAssetLoader = () => {

    const assetTypes = hookService.redux('assetTypeList', []);

    const selected = assetTypes.reduce((obj, type) => ({
      ...obj,
      [type] : [],
    }), {});

    const pageAssetContent = hookService.redux('asset', baseAssetContent);

    const loadedContent = {};

    const have = (type) => {
      return (selected[type] || []).length !== 0;
    }

    // NOTE: pug does not support async! for the best experience, assets
    // are loaded asynchronously in middleware and passed to locals.
    // in pug template they are then added in-order conditionally to
    // the page. I do not have a great solution besides pre-loading
    // all assets and picking them out synchronously.
    const preload = async (types = assetTypes) => {
      return Promise.all(arrayIntersect(assetTypes, types).map(async (type) => {
        // Every asset is preloaded (only read from file once in prod)
        // - each asset is required in order in pug and the order cannot
        //   be known ahead of time.
        // - because pug cannot load these asynchronously
        const nameLookup = pageAssetContent[type] || {};
        const names = Object.keys(nameLookup);
        for (const name of names) {
          loadedContent[type] = loadedContent[type] || {};
          const content = await pageAssetContent[type][name];
          loadedContent[type][name] = await content;
          logger.debug('Loaded %s : %s', type, name);
        }
        return pageAssetContent[type];
      })).catch((error) => {
        logger.error('%o', error);
        return null;
      });
    };

    const preloadAll = async () => {
      return preload();
    };

    // NOTE: for load each to work as expected, preload has
    // to be called ahead of time.
    const loadEach = (type, passedNames = null) => {
      const selectedAssets = selected[type] || [];
      if (isArray(passedNames)) {
        return arrayIntersect(selectedAssets, passedNames).map((name) => {
          return loadedContent[type][name] || '';
        }).join('\n\n');
      }
      return selectedAssets.map((name) => {
        return loadedContent[type][name] || '';
      }).join('\n\n');
    };

    return assetTypes.reduce((obj, type) => ({
      ...obj,
      [type] : (name) => selected[type].push(name),
    }), {
      have,
      loadEach,
      preload,
      preloadAll,
    });

  }

  // styles
  registerAsset('mazeltov-core', path.resolve(__dirname, '../asset/main.css'));

  // scripts
  registerAsset('jquery-core', path.resolve(__dirname, '../asset/jquery.min.js'));
  registerAsset('jquery-ui-core', path.resolve(__dirname, '../asset/jquery-ui.min.js'));
  registerAsset('mazeltov-core', path.resolve(__dirname, '../asset/core.js'));

  return {
    bindAssetLoader,
    registerAsset,
  };

}
