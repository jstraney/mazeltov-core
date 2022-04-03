const {
  string: {
    constantCase,
  },
  type: {
    isArray,
    isString,
  }
} = require('../lib/util');

const path = require('path');

module.exports = ( ctx ) => {

  const {
    appRoot,
  } = ctx;

  // The appRoot is identified by the fs root of the project so it is
  // set here to be retrieved by getSettings and shouldn't be set
  // manually in .env
  process.env.APP_ROOT = appRoot;

  // similarly, there shouldn't be a need to inject the app.url setting
  // as it's derived from the proto, host, and port
  // TODO: consider adding a relative path to spec. May require many
  // more changes so currently is unsupported.
  process.env.APP_URL = process.env.APP_URL ?? new URL('/', [
    process.env.APP_PROTO, '://',
    process.env.APP_HOSTNAME,
  ].join('') + (['80','443'].includes(process.env.APP_PORT) ? '' : ':' + process.env.APP_PORT));

  const envFilePath = process.env.APP_ENV_PATH || appRoot;

  require('dotenv').config({ path: path.resolve(envFilePath, '.env')});

  const makeEnvKey = (moduleName, settingName = null) => {
    if (settingName) {
      return constantCase(`${moduleName}_${settingName}`);
    }
    const [nextModuleName, ...rest] = moduleName.split('.');
    return constantCase(`${nextModuleName}_${rest.join('_')}`);
  };

  const getSettings = (names, asObject = false) => {
    if (asObject) {
      return names.reduce((result, name) => {
        if (isString(name)) {
          const envKey = makeEnvKey(name);
          const value = process.env[envKey];
          return value !== undefined
            ? {...result, [envKey]: value }
            : result;
        } else if (isArray(name)) {
          const [nextName, defaultValue] = name;
          const envKey = makeEnvKey(nextName);
          const value = process.env[envKey] ?? defaultValue;
          return value !== undefined
            ? {...result, [envKey]: value }
            : result;
        }
        return result;
      }, {});
    }

    return names.map((name) => {
      const envKey = makeEnvKey(name);
      return process.env[envKey];
    });
  };

  const getSetting = (name, defaultValue) => {
    return getSettings([name]).pop() ?? defaultValue;
  };

  return {
    getSetting,
    getSettings,
    makeEnvKey,
  }
};
