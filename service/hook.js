const objectHash = require('object-hash');

const {
  type: {
    isFunction,
    isString,
  },
} = require('../lib/util');

/*
 * Basic hook service. Hooks are registered callbacks that
 * have a side-effect and no returned result, reducers will
 * accumulate the results and return to the invoker.
 * publish and subscribe allow messages to be sent to a
 * subscriber by a publisher. petition is like reverse pub/sub
 * where the petitioned (calling onPetition) returns a result
 * and the petitioner gathers these independent results.
 * petitioning is async because the results should be
 * independent from one another.
 */
module.exports = ( ctx ) => {

  const {
    loggerLib,
  } = ctx;

  logger = loggerLib('@mazeltov/core/service/hook');

  // TODO: there can very well be a use-case for async hooks.
  // hooks should perform side-effects where each callback is
  // not necessarily dependent on the other. Hooks are akin
  // to a publisher with multiple subscribers.

  /*
   * EventEmitter wasn't used because we want to return
   * results from reducers and most of these hooks should
   * be running when the app starts up.
   */
  const hooks = {};

  const onHook = (name, cb) => {
    if (!isString(name)) {
      throw new TypeError(`name is expected to be string, got: ${name}`);
    }
    if (!isFunction(cb)) {
      throw new TypeError(`cb is expected to be function, got: ${cb}`);
    }
    hooks[name] = hooks[name] || [];
    hooks[name].push(cb);
  };

  const hook = (name, ...args) => {
    const cbs = hooks[name] || [];
    for (const cb of cbs) {
      cb(...args);
    }
  };

  const reducers = {};

  // one is a lookup for cached results
  // munged just indicates if there was a change to
  // the redux callback chain which indicates
  const reduxResults = {};

  const onRedux = (name, cb) => {
    if (!isString(name)) {
      throw new TypeError(`name is expected to be string, got: ${name}`);
    }
    if (!isFunction(cb)) {
      throw new TypeError(`cb is expected to be function, got: ${cb}`);
    }
    reducers[name] = reducers[name] || [];
    reducers[name].push(cb);
    // a new callback added could imply a different result so any
    // invoker needs to fetch fresh.
    reduxResults[name] = {};
  };

  const redux = (name, ...args) => {
    const hash = objectHash([name].concat(args));
    const resultLookup = reduxResults[name] || {};
    const cachedResult = resultLookup[hash];
    if (cachedResult !== undefined) {
      return cachedResult;
    }
    const [init, ...rest] = args;
    let result = init;
    const cbs = reducers[name] || [];
    if (cbs.length === 0) {
      return init;
    }
    for (let i = 0; i < cbs.length; i++) {
      const cb = cbs[i];
      result = cb(result, ...rest);
      if (result === undefined) {
        logger.warn([
          'Reducer callback %s for %s returned undefined.',
          'be sure to return something from a reducer, even',
          'null where expected to prevent bugs.'
        ].join(' '), i, name);
      }
    }
    resultLookup[hash] = result;
    reduxResults[name] = resultLookup;
    return result;
  };

  const petitions = {};

  const onPetition = (name, cb) => {
    if (!isString(name)) {
      throw new TypeError(`name is expected to be string, got: ${name}`);
    }
    if (!isFunction(cb)) {
      throw new TypeError(`cb is expected to be function, got: ${cb}`);
    }
    petitions[name] = petitions[name] || [];
    petitions[name].push(cb);
  };

  const petition = (name, ...args) => {
    const cbs = petitions[name] || [];
    return Promise.all(cbs.map((fn) => fn(...args)));
  };

  const getHooks = () => hooks;

  const getReducers = () => reducers;

  const getPetitions = () => petitions;

  return {
    getHooks,
    getPetitions,
    getReducers,
    hook,
    onHook,
    onPetition,
    onRedux,
    petition,
    redux,
  };

};
