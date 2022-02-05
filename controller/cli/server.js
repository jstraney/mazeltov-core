const
fs = require('fs'),
http = require('http'),
https = require('https'),
path = require('path');

module.exports = ( ctx ) => {

  const {
    app,
    appRoot,
    controllers: {
      httpController,
      apiControllers,
      webControllers,
    },
    services: {
      settingService: {
        getSettings,
      },
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/core/controller/cli/server');

  const [
    appCertFile,
    appKeyFile,
    appProto,
    appName,
    appIface,
    appPort,
  ] = getSettings([
    'app.certFile',
    'app.keyFile',
    'app.proto',
    'app.name',
    'app.iface',
    'app.port',
  ]);

  // allow httpControllers and simple express routers
  const toRouters = (router) => {
    return router.hasOwnProperty('buildRouter')
      ? router.buildRouter()
      : router;
  };

  return {
    'server start': {
      consumer: async (args) => {
        app.use(httpController.flat().map(toRouters))
        if (apiControllers.length) {
          app.use('/api', apiControllers.flat().map(toRouters));
        }
        if (webControllers.length) {
          app.use('/', webControllers.flat().map(toRouters));
        }

        let server;

        if (appProto === 'https') {
          const cert = fs.readFileSync(path.resolve(appRoot, appCertFile));
          const key = fs.readFileSync(path.resolve(appRoot, appKeyFile));
          server = https.createServer({ key, cert }, app);
        } else {
          server = http.createServer(app);
        }
        server.listen(appPort, appIface, () => {
          logger.info('%s running on %s:%s', appName, appIface, appPort);
        });
      },
      description: 'Start the http(s) server',
      hup: false,
    },
  };
}
