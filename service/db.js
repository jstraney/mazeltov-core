const path = require('path');

module.exports = async ( ctx ) => {

  const {
    appRoot,
    inProject,
    services: {
      envService: {
        getSettings,
      },
      hookService: {
        onHook,
      },
    },
  } = ctx;

  if (!inProject) {
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

  return db;

};
