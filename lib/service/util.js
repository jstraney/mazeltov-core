const
fs   = require('fs')
path = require('path');

const {
  collection: {
    peak,
  },
  type: {
    isArray,
    isObject,
    isFunction,
    isString,
    isNotEmpty,
  },
  string: {
    pascalCase,
    pluralize,
    rtrim,
  },
} = require('../util');

/**
 * Mazeltov is made of services, but a few different
 * service types are controllers and models. You could define
 * your own "service types" or "code part" which get
 * loaded in a similar fashion. One example could be
 * if you wanted to use a "repository" pattern.
 * You could create a directory called "repository"
 * which has a service loader of type repository.
 */
const serviceLoader = (type = null, options = {}) => {

  const {
    pathPrefix = null,
    parentType = null,
    toArray = false,
    flat = false,
  } = options;

  if (!type) {
    throw new Error('A serviceLoader requires a type');
  }

  const fullType = parentType === null
    ? type
    : `${type}${pascalCase(parentType)}`

  const typePlural = pluralize(type);

  const typeSuffix = parentType === null
    ? pascalCase(type)
    : `${pascalCase(type)}${pascalCase(parentType)}`;

  const typePluralSuffix = pascalCase(pluralize(type));
  const fullTypePluralSuffix = pluralize(typeSuffix);

  // You can return the results as an array (such as with
  // http controllers where the order of route handling matters)
  const loader = async (ctx = {}, instanceNames = [], dir = null) => {

    const arrayReturn = [];

    const {
      appRoot,
      services = {}
    } = ctx;

    // if (root path already ends with the type, remove it.
    // otherwise, for example, if we pass the dir for
    // /.../access/service, we would get /.../service/service
    let rootPath = dir ? dir : appRoot;

    // e.g. loaderService, modelService, controllerService
    const {
      [`${type}Service`]: abstractService = {},
      [`${fullType}Service`]: fqAbstractService = {},
    } = services;

    let instances = ctx[typePlural] || {};

    // failsafe counter to prevent crashing in case a dev doesn't
    // use the ${fullType}Param callback correctly
    let c = 0;

    for (let i = 0; i < instanceNames.length; c++) {

      // let the dev know and throw error.
      if (c >= instanceNames.length) {
        throw Error([
          'Something is wrong with your call to',
          `${fullType}Params callback. It must return an`,
          'an array, the second element is an index greater than',
          'the params passed to the loader to tell the loader to exit.',
          'Failure to do this would cause an infinite loop.',
        ].join(' '));
      }

      const name = instanceNames[i];

      const nextCtx = {...ctx, [typePlural]: instances};
      const defaultParams = [nextCtx, loader];
      // You can define how to consume the stack for loading, e.g.
      // 'nameOfController'
      // [ /*route strings*/ ]
      // { /*a config object*/ }
      let instanceParams, nextI;
      if (isFunction(abstractService[`${fullType}Params`])) {
        [instanceParams, nextI] = abstractService[`${fullType}Params`](defaultParams, instanceNames, i);
      } else if (isFunction(fqAbstractService[`${fullType}Params`])) {
        [instanceParams, nextI] = fqAbstractService[`${fullType}Params`](defaultParams, instanceNames, i);
      } else {
        [instanceParams, nextI] = [defaultParams, i + 1]
      }

      // allow a special handling of loading the serviceType (such as it is done
      // for controllers which there are many types and subtypes)
      if (isFunction(abstractService[`${fullType}LoadInstance`])) {
        const instance = abstractService[`${fullType}LoadInstance`](...instanceParams);
        if (instance) {
          if (flat) {
            instances = {
              ...instances,
              ...instance
            };
          } else if (isString(name)) {
            instances[`${name}${typeSuffix}`] = instance;
          } else {
            instances = {
              ...instances,
              ...instance
            };
          }
          toArray && arrayReturn.push(instance);
          i = nextI;
          continue;
        }
      } else if (isFunction(fqAbstractService[`${fullType}LoadInstance`])) {
        const instance = fqAbstractService[`${fullType}LoadInstance`](...instanceParams);
        if (instance) {
          if (flat) {
            instances = {
              ...instances,
              ...instance
            };
          } else {
            instances[`${name}${typeSuffix}`] = instance;
          }
          toArray && arrayReturn.push(instance);
          i = nextI;
          continue;
        }
        // if no instance is returned, use the default handler below
        // which handles many use cases.
      }

      if (isArray(name)) {
        const [alias, fn] = name;
        const instance = await fn(...instanceParams);
        if (flat) {
          instances = {
            ...instances,
            ...instance
          };
        } else {
          instances[`${alias}${typeSuffix}`] = instance;
        }
        toArray && arrayReturn.push(instance);
        i = nextI;
        continue;
      } else if (isFunction(name)) {
        const subInstances = await name(...instanceParams);
        instances = {
          ...instances,
          ...subInstances
        };
        toArray && arrayReturn.push(subInstances);
        i = nextI;
        continue;
      // An object must similarly be have the fully qualified service names
      // as keys and the service interfaces as values.
      // (e.g. myModuleMenuService)
      } else if (isObject(name)) {
        instances = {
          ...instances,
          ...name
        };
        toArray && arrayReturn.push(instance);
        i = nextI;
        continue;
      }

      let customPath;

      // only if we are exporting does the dir get passed in,
      // if the dir was not passed (relying on appRoot), then
      // we use the prefix
      if (dir === rootPath) {
        customPath = path.resolve(dir, `${name}.js`);
      } else if (pathPrefix) {
        customPath = rootPath
          ? path.resolve(rootPath, `${pathPrefix}/${type}/${name}.js`)
          : null;
      } else {
        customPath = rootPath
          ? path.resolve(rootPath, `${type}/${name}.js`)
          : null;
      }
      // console.log(type, rootPath, customPath);

      const corePath = pathPrefix
        ? path.resolve(__dirname, `../../${pathPrefix}/${type}/${name}.js`)
        : path.resolve(__dirname, `../../${type}/${name}.js`);

      if (customPath !== null && fs.existsSync(customPath)) {
        const instance = await require(customPath)(...instanceParams);
        if (flat) {
          instances = {
            ...instances,
            ...instance
          };
        } else {
          instances[`${name}${typeSuffix}`] = instance;
        }
        toArray && arrayReturn.push(instance);
        i = nextI;
        continue;
      }

      i = nextI;
      const instance = await require(corePath)(...instanceParams);
      if (flat) {
        instances = {
          ...instances,
          ...instance
        };
      } else {
        instances[`${name}${typeSuffix}`] = instance;
      }
      toArray && arrayReturn.push(instance);
    }

    if (isFunction(abstractService[`register${typePluralSuffix}`])) {
      abstractService[`register${typePluralSuffix}`](instances);
    }
    if (isFunction(fqAbstractService[`register${fullTypePluralSuffix}`])) {
      fqAbstractService[`register${fullTypePluralSuffix}`](instances);
    }

    return toArray
      ? arrayReturn
      : instances;

  };

  return loader;

};

module.exports = {
  serviceLoader,
};
