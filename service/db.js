const path = require('path');

module.exports = async ( ctx ) => {

  const {
    appRoot,
    envExists,
    inProject,
    services: {
      envService: {
        getSettings,
      },
      hookService: {
        onHook,
      },
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/db');

  if (!inProject || !envExists) {
    return null;
  }

  // These are only available in the .env file for now
  // It'd be cool to be able to set this in DB itself but is
  // a clear circular dependency (cannot use settingService to
  // load db config from db to bootstrap db connections)
  const knexSettings = getSettings([
    'app.dbClient',
    'app.dbUser',
    'app.dbPassword',
    'app.dbHost',
    'app.dbDatabase',
    'app.dbDebug',
    'app.dbMinPool',
    'app.dbMaxPool',
    'app.dbTimeout'
  ], true);


  const knexfilePath = path.resolve(appRoot, 'knexfile.js');
  const knexfileExport = await require(knexfilePath)(knexSettings);

  const db = require('knex')(knexfileExport);

  // prevent hang on cli commands
  onHook('appHangup', () => {
    db.destroy();
  });

  await db.raw('SELECT 1').catch((error) => {
    logger.debug('%o', error);
    logger.info('No database found');
    db = null;
  });

  return db;

};
