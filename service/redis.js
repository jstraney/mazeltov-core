module.exports = ( ctx ) => {

  const {
    services: {
      hookService: {
        onHook,
      },
      settingService: {
        getSettings,
      },
    }
  } = ctx;

  // TODO: other configs? just using convention over configuration for now
  // but could probably (without too much difficulty just put keys here with
  // defaults? e.g. port = <default port>)
  const [
    host,
    password,
  ] = getSettings([
    'app.redisHostname',
    'app.redisPassword',
  ]);

  const redis = new (require('ioredis'))({
    host,
    password,
  });

  // prevent hang on cli commands
  onHook('appHangup', () => {
    redis.disconnect();
  });

  return redis;

}
