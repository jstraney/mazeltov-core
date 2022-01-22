const url = require('url');

const {
  collection: {
    peak,
  },
  string: {
    constantCase,
  },
  type: {
    isArray,
    isString,
  },
} = require('../lib/util');

const { JSONPath } = require('jsonpath-plus');

/**
 * What are settings? A setting is a configuration
 * attached to the app or a module belonging to the app.
 * When you run `mazeltov module install <name>` migrations
 * are run (which should include populating settings in the
 * mazeltov.setting table). When the app starts, these are loaded
 * from the DB, overwritten if an identical setting exists in .env
 */
module.exports = async ( ctx ) => {

  const {
    services: {
      hookService: {
        onRedux,
        redux,
      },
      moduleService: {
        getEnabledModules,
      },
      dbService,
      envService: {
        makeEnvKey,
        getSettings: getEnvSettings,
        getSetting: getEnvSetting,
      },
    },
  } = ctx;

  let settingRecords;

  if (dbService) {

    const modules = getEnabledModules();

    settingRecords = await dbService('setting')
      .withSchema('mazeltov')
      .whereIn('moduleName', Object.keys(modules));
  } else {
    settingRecords = [];
  }

  // lookup helpers
  const canHasEnvOverride = {};
  const canHasWebOverride = {};
  const settingInDb = {};

  /**
   * Loads the settings from DB into memory, and will overwrite
   * if there is a setting in .env. These settings MUST follow
   * a {MODULE_NAME}_{SETTING_NAME} semantics moving forward.
   */
  onRedux('setting', (settings = {}) => {
    return settingRecords.reduce((lookup, record) => {

      const {
        name,
        moduleName,
        value,
        isEnvConfigurable = true,
        isWebConfigurable = false,
      } = record;

      if (!lookup[moduleName]) {
        lookup[moduleName] = {};
      }

      const settingKey = `${moduleName}.${name}`;

      if (isEnvConfigurable) {
        canHasEnvOverride[settingKey] = true;
      }
      if (isWebConfigurable) {
        canHasWebOverride[settingKey] = true;
      }

      try {

        let nextValue;
        if (isEnvConfigurable) {
          nextValue = getEnvSetting(settingKey);
        }

        // any module setting can be set in the
        // .env file as well but is usually just for core settings.
        // these values take precedence over what is in the database
        if (nextValue === undefined) {
          nextValue = JSON.parse(value);
        }

        lookup[moduleName][name] = nextValue;
        settingInDb[settingKey] = true;
        return lookup;
      } catch (error) {
        logger.error('%o', error);
        logger.error('Could not parse %s.%s setting as JSON value', moduleName, name);
        return lookup;
      }
    }, settings);
  });

  /**
   * Saves setting in the current process and writes to database.
   * Right now, there is no mechanism for the application to reload
   * but it is on the roadmap.
   */
  const saveSetting = async (path, value) => {
    const parts = path.split('.');
    const fst = peak(parts);
    const snd = parts[1];
    const lst = parts.pop();
    const settings = redux('setting', {});
    const escapedPath = escapePath(path)
    const parent = JSONPath({path: escapedPath, json: settings  });
    // get a pointer to the send to last thing
    parent[lst] = value;
    try {
      await dbService('setting')
        .withSchema('mazeltov')
        .where({
          moduleName: fst,
          name: snd,
        })
        .update({
          value: JSON.stringify(snd),
        });
    } catch (error) {
      logger.error('%o', error);
      logger.error('Could not save setting %s = %s', parts.join('.'), value);
    };
  };

  // the module name of a setting may include @, so we quote it
  const escapePath = (path) => `\`${path}`;

  const getSettings = (names = [], asObject = false) => {

    const settings = redux('setting', {});

    if ((!names || !names.length) && asObject) {
      return settings;
    } else if (!names || !names.length) {
      return Object.values(settings);
    }

    if (asObject) {
      return names.reduce((result, name) => {

        if (isString(name)) {
          // when exporting as object, env key is used
          // for code portability (simpler to destructure APP_PORT
          // as instead of app.port from object)
          const envKey = makeEnvKey(name);

          if (canHasEnvOverride[name] || !settingInDb[name]) {
            const value = getEnvSetting(name);
            if (value !== undefined) {
              return {
                ...result,
                [envKey]: value,
              }
            }
          }

          const escapedPath = escapePath(name);
          const values = JSONPath({ path: escapedPath, json: settings });

          // don't set the key at all if it doesn't exist so that
          // default values work in code for destructuring.
          return values.length
            ? {...result, [envKey]: values.pop() }
            : result;
        } else if (isArray(name)) {

          const [nextName, defaultValue] = name;

          const envKey = makeEnvKey(nextName);

          if (canHasEnvOverride[nextName] || !settingInDb[nextName]) {
            const value = getEnvSetting(nextName);
            if (value !== undefined) {
              return {
                ...result,
                [envKey]: value,
              }
            }
          }

          const escapedPath = escapePath(name)
          const values = JSONPath({ path: escapedPath, json: settings });

          // don't set the key at all if it doesn't exist so that
          // default values work in code for destructuring.
          return values.length
            ? {...result, [envKey]: values.pop() }
            : {...result, [envKey]: defaultValue };
        }
        return result;
      }, {});
    }

    return names.map((name) => {

      // unless expressly forbidden, you can get values from .env
      if (canHasEnvOverride[name] || !settingInDb[name]) {
        const value = getEnvSetting(name);
        if (value !== undefined) {
          return value;
        }
      }

      const escapedPath = escapePath(name)
      const result = JSONPath({ path: escapedPath, json: settings });

      return result.length > 0
        ? result.pop()
        : undefined;

    });

  };

  const getSetting = (name, defaultValue) => {
    return getSettings([name]).pop() ?? defaultValue;
  };

  const [
    appProto,
    appHostname,
    appPort,
  ] = getSettings([
    'app.proto',
    'app.hostname',
    'app.port',
  ]);

  // Derive some basic settings from others.
  // for instance, the app URL is derived from
  // proto, hostname, port and there is really no other
  // logical way to set this.
  onRedux('setting', (settings) => ({
    ...settings,
    app: {
      ...(settings.app || {}),
      url: url.format({
        protocol: appProto,
        hostname: appHostname,
        port: appPort,
      }),
    },
  }));



  return {
    getSettings,
    getSetting,
    saveSetting
  };

};
