const
fs   = require('fs'),
path = require('path');

const { execSync } = require('child_process');

const {
  rand: {
    randStr,
  },
  string: {
    capitalCase,
  },
} = require('../lib/util');

const prompt = require('prompt');

module.exports = ( ctx = {} ) => {

  const {
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/cli/service/project');

  const gitURL = 'git@github.com:jstraney/mazeltov-project.git';

  const isInProjectDir = (dir) => {
    const pkgPath = path.resolve(dir, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      return false;
    }
    const pkg = require(pkgPath);
    return !!(pkg.generatedWith === 'mazeltov');
  }

  const hasEnvFile = (dir) => {
    return fs.existsSync(path.join(dir, '.env'));
  };

  const getTranslatedModuleName = (moduleName) => {
    switch (moduleName) {
      case 'core':
        return '@mazeltov/core';
      default:
        return moduleName;
    }
  };

  const getModulePath = (baseDir, moduleName) => {
    switch (moduleName) {
      case null:
        return baseDir;
      case 'core':
        return path.resolve(baseDir, 'node_modules/@mazeltov/core');
      default:
        return path.resolve(baseDir, 'node_modules/', moduleName);
    }
  };

  const runEnvPrompt = async (rootDir, skipPrompt) => {

    if (hasEnvFile(rootDir)) {

      logger.warn('An .env file was found. This will be overwritten.');

      let yesNo;

      while (/^y|yes$/i.text(yesNo)) {

        const { answer } = await prompt.get({
          properties: {
            answer: {
              description: 'Proceed?',
              required: true,
              default: 'n',
            }
          }
        });

        yesNo = answer;

        if (/^n|no$/i.text(yesNo)) {
          logger.info('Aborting setup!');
          return;
        }

      }

      logger.info('Okay!');
    }

    if (skipPrompt) {
      return {
        serviceName: 'mazeltov',
        hostname: 'local.mazeltov.com',
        databaseName: 'mazeltov',
        databaseUser: 'mazeltov',
        databasePassword: randStr(32),
        redisPassword: randStr(32),
      };
    }


    logger.info('Some .env questions (you can skip with -s in the future and edit .env)');

    prompt.start();

    return prompt.get({
      properties: {
        serviceName: {
          description: 'Service Name',
          required: true,
          default: 'mazeltov',
        },
        hostname: {
          description: 'Host Name',
          required: true,
          default: 'local.mazeltov.com',
        },
        databaseName: {
          description: 'Database Name',
          default: 'mazeltov',
        },
        databaseUser: {
          description: 'Database User',
          default: 'mazeltov',
        },
        databasePassword: {
          description: 'Database Password',
          default: randStr(32),
        },
        redisPassword: {
          description: 'Redis Password',
          default: randStr(32),
        },
      },
    });

  }

  const setupEnv = (rootDir, promptValues) => {

    const {
      serviceName,
      hostname,
      databaseName,
      databaseUser,
      databasePassword,
      redisPassword
    } = promptValues;

    // Walk through prompt and update the buffer
    const configs = {
      APP_COOKIE_DOMAIN: hostname,
      APP_COOKIE_SECRET: randStr(64),
      APP_CORS_ALLOWED_ORIGINS: `https://${hostname}`,
      APP_HOSTNAME: hostname,
      APP_NAME: serviceName,
      APP_SESSION_SECRET: randStr(64),

      APP_ORG_NAME: capitalCase(serviceName),
      APP_ORG_SUPPORT_EMAIL: `support@${hostname}`,
      APP_ORG_SUPPORT_PHONE: '+11231231234',

      APP_DB_DATABASE: databaseName,
      APP_DB_DEBUG: false,
      APP_DB_PASSWORD: databasePassword,
      APP_DB_USER: databaseUser,
      APP_REDIS_PASSWORD: redisPassword,

      /* TODO: Create the <name>ModuleInstall hook
       * and have the following set by @mazeltov/access module in DB
       * or to .env file.
       *
       * SELF_CLIENT_ID: randStr(32),
       * SELF_CLIENT_SECRET: randStr(32),
       * SELF_CLIENT_REDIRECT_URLS: `https://${hostname}/account`,
       * DEFAULT_CLIENT_ID: randStr(32),
       * DEFAULT_CLIENT_SECRET: randStr(32),
       * DEFAULT_CLIENT_REDIRECT_URLS: `https://${hostname}/account`,
       * DEFAULT_PERSON_PASSWORD: randStr(32),
       */
    };

    let newEnv = fs.readFileSync(`${rootDir}/example.env`, { encoding: 'utf8' });

    logger.info(`Replacing values in .env`);

    for (const name in configs) {

      const value = configs[name];

      newEnv = newEnv.replace(new RegExp(`${name}=\{\{REPLACE\}\}`), `${name}=${value}`);

    }

    // write buffer to .env
    fs.writeFileSync(`${rootDir}/.env`, newEnv);

  };

  // set up certs for local development
  const setupSSLCerts = (rootDir, promptValues) => {

    const {
      hostname,
      serviceName
    } = promptValues;

    logger.info('Creating cert for local environment. DO NOT USE IN PROD');

    // create the SSL certificate for local development
    execSync([
      `openssl req -new -newkey rsa:2048 -nodes -x509 -days 365`,
      `-subj "/C=US/ST=Province/L=City/O=${serviceName}/CN=${hostname}"`,
      `-keyout ${rootDir}/rsa/server.key -out ${rootDir}/rsa/server.crt`,
    ].join(' '), {stdio: 'pipe'});

  };

  const setup = async ( args = {} )  => {

    const {
      path = '.',
      skipPrompt = false,
    } = args;

    const promptValues = await runEnvPrompt(path, skipPrompt);

    setupEnv(path, promptValues);
    setupSSLCerts(path, promptValues);

    logger.info(`Installing dependencies (one second)...`);

    // install node packages for new project
    execSync(`npm i --prefix ${path}`, {stdio: 'pipe'});

  };

  const create = async ( args = {} ) => {

    const {
      name,
      pathPrefix = '.',
      skipPrompt = false,
    } = args;

    const rootDir = path.join(pathPrefix, name);

    logger.info('Cloning skeleton repo for @mazeltov/project');

    logger.debug(`git clone ${gitURL} ${rootDir}`);

    // clone project directory at 'path' + 'name'
    execSync(`git clone ${gitURL} ${rootDir}`, { stdio: 'pipe'});

    await setup({
      path: rootDir,
      skipPrompt,
    });

    // remove the .git directory
    fs.rmSync(`${rootDir}/.git`, { recursive: true, force: true });

    execSync(`git init ${rootDir}`, {stdio: 'pipe'});

    return null;

  };

  return {
    create,
    setup,
    hasEnvFile,
    isInProjectDir,
    getModulePath,
    getTranslatedModuleName,
  };

}
