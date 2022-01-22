const {
  type: {
    isArray,
    isFunction,
    isObject,
    isString,
  },
} = require('../lib/util')
const {
  httpController,
} = require('../lib/controller');

/**
 * The controller service helps register higher level
 * rules for URI path generation, middleware and more
 * based on the action and model passed. A good rule of
 * thumb is to keep these incredibly generic and not
 * switch too much based on model entityType
 *
 * Again, these switches are for boiler plate routes
 * and resources without much customization. If you
 * need a highly customized set of rules for an entity
 * It's possible that:
 * - breaking up into more entities makes it simpler
 * - creating a file in your controller dir is the way to go.
 */
module.exports = ( ctx = {} ) => {

  const {
    services,
    services: {
      hookService,
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/controller');

  // Used for web, api, and cli controllers which use shorthand params
  // to automagically build controllers from models.
  const subtypeControllerParams = (defaultParams, instanceNames, index) => {
    const [fst, snd, thrd] = instanceNames.slice(index);
    if (isObject(fst)) {
      return [defaultParams, index + 1]
    } else if (isFunction(fst)) {
      return [defaultParams, index + 1]
    } else if (isString(fst)) {
      const params = defaultParams.concat(fst);
      index++;
      if (isArray(snd)) {
        params.push(snd) && index++;
      }
      if (isObject(thrd)) {
        params.push(thrd) && index++;
      }
      return [params, index];
    }
    return [defaultParams, index + 1];
  };

  return {
    subtypeControllerParams,
  };

};
