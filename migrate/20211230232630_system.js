exports.up = async function(trx) {

  await trx.raw('CREATE SCHEMA IF NOT EXISTS mazeltov')

  await trx.schema
    .withSchema('mazeltov')
    .createTable('module', (table) => {

      table.comment([
        'In Mazeltov, plugable systems of functionality',
        'are called modules because they really are just node',
        'modules that follow a semantic structure.',
      ].join(' '));

      table.text('name')
        .notNullable()
        .primary();

      table.boolean('isSymlinked')
        .notNullable()
        .defaultTo(false);

      table.boolean('hasMigrations')
        .notNullable()
        .defaultTo(false)

      table.boolean('hasViews')
        .notNullable()
        .defaultTo(false)

      table.boolean('hasAssets')
        .notNullable()
        .defaultTo(false)

      table.boolean('hasModels')
        .notNullable()
        .defaultTo(false)

      table.boolean('hasControllers')
        .notNullable()
        .defaultTo(false)

      table.boolean('hasServices')
        .notNullable()
        .defaultTo(false)

      table.boolean('isInstalled')
        .notNullable()
        .defaultTo(false)

      table.boolean('isEnabled')
        .notNullable()
        .defaultTo(false)

      table.timestamps(true, true);

    })
    .createTable('setting', (table) => {

      table.comment([
        'The setting table is the home for configuration as it relates',
        'to various modules and the application itself. Each value is a',
        'JSON de/serializable value that reduces complexity in needing to',
        'marshal and label types in the table. While nested config is supported',
        'it is recommended to keep each setting flat so it can more easily be',
        'overridden in forms and in .env files',
      ].join(' '))

      table.text('moduleName')
        .notNullable();

      table.text('name')
        .notNullable();

      table.text('label')
        .notNullable();

      table.text('description')
        .notNullable()
        .defaultTo('');

      table.boolean('isWebConfigurable')
        .notNullable()
        .defaultTo(false)
        .comment([
          'Allows setting to be changed in UI using admin form',
        ].join(' '))

      table.boolean('isEnvConfigurable')
        .notNullable()
        .defaultTo(true)
        .comment([
          'Allows setting to be overriden by .env file in app root',
          'directory. Settings in env must follow {{MODULE_NAME}}_{{SETTING_NAME}}',
          'in order to override effectively.',
        ].join(' '))

      table.jsonb('value');

      table.primary(['moduleName', 'name']);

      table.timestamps(true, true);

    });

  // Core settings
  await trx('setting').withSchema('mazeltov')
    .insert([
      {
        moduleName: 'app',
        name: 'cookieDomain',
        label: 'Cookie Domain',
        description: 'Domain used for setting client cookie',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'cookieMaxage',
        label: 'Cookie Max Age',
        description: 'Max age in milliseconds of cookie',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'cookieMaxage',
        label: 'Cookie Max Age',
        description: 'Max age in milliseconds of cookie',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'corsAllowedOrigins',
        label: 'CORS Allowed Origins',
        description: 'Comma separated list of allowed origins',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'orgName',
        label: 'Organization Name',
        description: 'Readable organization name',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'orgSupportEmail',
        label: 'Organization Support Email',
        description: 'Generic organization support email for templates',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'orgSupportPhone',
        label: 'Organization Support Phone',
        description: 'Generic organization support phone for templates',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'orgSupportPhone',
        label: 'Organization Support Phone',
        description: 'Generic organization support phone for templates',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'certFile',
        label: 'SSL Certificate File Path',
        description: 'SSL certificate file path',
        value: JSON.stringify('rsa/server.crt'),
      },
      {
        moduleName: 'app',
        name: 'keyFile',
        label: 'SSL Key File Path',
        description: 'SSL key file path',
        value: JSON.stringify('rsa/server.key'),
      },
      {
        moduleName: 'app',
        name: 'name',
        label: 'Service Name',
        description: [
          'Machine readable name for the app as it will',
          'appear in logs. Do not include spaces'
        ].join(' '),
        value: null,
      },
      {
        moduleName: 'app',
        name: 'hostname',
        label: 'Server Hostname',
        description: 'The primary host name used for links and self reference',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'iface',
        label: 'Server Interface',
        description: 'The IP address to listen to (e.g. 127.0.0.1 or 0.0.0.0)',
        value: JSON.stringify('0.0.0.0'),
      },
      {
        moduleName: 'app',
        name: 'port',
        label: 'Server Port',
        description: 'The HTTP(s) port to listen to',
        value: JSON.stringify('8080'),
      },
      {
        moduleName: 'app',
        name: 'proto',
        label: 'Server Protocol',
        description: [
          'http or https. You may want https in local environments,',
          'but have your app use http behind a https proxy in production.',
        ].join(' '),
        value: JSON.stringify('https'),
      },
      {
        moduleName: 'app',
        name: 'sessionSecret',
        label: 'Server Session Secret',
        description: 'Secret used for client sessions',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'trustedProxies',
        label: 'Server Trusted Proxies',
        description: 'Trusted proxies as used by express middleware',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'dbClient',
        label: 'Database Client Type',
        description: 'knex database client type (pg only officially supported)',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'dbDatabase',
        label: 'Database name',
        description: 'Name of logical database',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'dbDebug',
        label: 'Database Debug',
        description: 'Enable verbose database logging (values are "true"/"false")',
        value: JSON.stringify('false'),
      },
      {
        moduleName: 'app',
        name: 'dbHost',
        label: 'Database Host',
        description: 'Primary database host',
        value: JSON.stringify('mazeltov-postgres'),
      },
      {
        moduleName: 'app',
        name: 'dbPassword',
        label: 'Database Password',
        description: [
          'Database password. For security reasons you\'ll want to put',
          'this in your .env file as APP_DB_PASSWORD',
        ].join(' '),
        value: JSON.stringify('mazeltov-postgres'),
      },
      {
        moduleName: 'app',
        name: 'dbPoolMax',
        label: 'Database Max Pooled Connections',
        description: 'Maximum pooled connections to database',
        value: JSON.stringify(10),
      },
      {
        moduleName: 'app',
        name: 'dbPoolMin',
        label: 'Database Min Pooled Connections',
        description: 'Minimum pooled connections to database',
        value: JSON.stringify(1),
      },
      {
        moduleName: 'app',
        name: 'dbTimeout',
        label: 'Database Max Timeout',
        description: 'Timeout for DB connections in milliseconds',
        value: JSON.stringify(20000),
      },
      {
        moduleName: 'app',
        name: 'dbUser',
        label: 'Database User',
        description: 'Database username for connection',
        value: null,
      },
      {
        moduleName: 'app',
        name: 'redisHostname',
        label: 'Redis Hostname',
        description: 'Hostname for redis connection',
        value: JSON.stringify('mazeltov-redis'),
      },
      {
        moduleName: 'app',
        name: 'redisPassword',
        label: 'Redis Password',
        description: 'Password for redis',
        value: null,
      },
    ])
    .onConflict(['name', 'moduleName'])
    .ignore();

};

exports.down = async function(trx) {

  await trx.schema
    .withSchema('mazeltov')
    .dropTable('module')
    .dropTable('setting');

};
