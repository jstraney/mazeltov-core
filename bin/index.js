#!/usr/bin/env node

const fs = require('fs').promises;
const existsSync = require('fs').existsSync;
const path = require('path');

(async () => {

  let inProject = false;

  const cwd = process.cwd();
  const pkgPath = path.resolve(cwd, 'package.json');

  if (existsSync(pkgPath)) {
    const pkg = require(pkgPath);
    inProject = pkg.generatedWith === 'mazeltov';
  }

  const envFilePath = process.env.APP_ENV_PATH || cwd;

  const envExists = existsSync(path.resolve(envFilePath, '.env'));

  if (envExists) {
    require('dotenv').config({ path: path.resolve(envFilePath, '.env')});
  }

  // some services really shouldn't bootstrap the entire
  // application for simplicity. Imagine trying to run migrations
  // and seeders for an app that calls module code that depends on
  // a schema to exist. commands beginning with these also use
  // bare bones services.
  // This includes the following:
  const useSimpleBoot = [
    'migration',
    'module',
    'setting',
    'project',
    'view',
    'seed',
  ].map((name) => new RegExp(`^${name}`))
  .reduce((use, regexp) => {
    return use || regexp.test(process.argv[2])
  }, false);

  const ctx = {
    appRoot: cwd,
    inProject,
    envExists,
    loggerLib: require('../lib/logger'),
  };

  // if in the project directory, load the projects services,
  // models and controllers to be used by cli.
  if (inProject && envExists && !useSimpleBoot) {

    // console.log('yeah boi');
    const project = await require(path.resolve(cwd, 'index.js'))(ctx);

    await project.controllers.cliControllers.prepareAndRun(process.argv.slice(2));

  // Do a bare minimum boot to prevent circular dependencies on database
  // and module code that may depend on it.
  } else {

    const {
      serviceLoader,
      controllerLoader,
    } = await require('../loader')(ctx, [
      'service',
      'controller',
    ]);

    // load only the minimum services needed.
    const services = await serviceLoader(ctx, [
      'hook',
      'init',
      'env',
      'db',
      'project',
      'migration',
      'seed',
      'view',
      'module',
      'setting',
      'route',
      'acl',
      'asset',
      'menu',
      'controller',
      'httpController',
      'webController',
      'apiController',
      'cliController',
    ]);

    const {
      cliController: cliControllerLoader,
    } = await controllerLoader({
      ...ctx,
      services,
    }, [
      'cli',
    ]);

    const cliControllers = await cliControllerLoader({ ...ctx, services }, [
      'cli',
      'project',
      'migration',
      'setting',
      'module',
      'seed',
      'view',
    ]);

    await cliControllers.prepareAndRun(process.argv.slice(2));

  }

})();
