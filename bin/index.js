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

  const ctx = {
    appRoot: cwd,
    inProject,
    loggerLib: require('../lib/logger'),
  };

  // if in the project directory, load the projects services,
  // models and controllers to be used by cli.
  if (inProject) {

    const project = await require(path.resolve(cwd, 'index.js'))(ctx);

    project.controllers.cliControllers.prepareAndRun(process.argv.slice(2));

  // load the "dry powder" needed to scaffold a new project, or run the
  // cli without any project available.
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
      'module',
      'seed',
      'view',
    ]);

    await cliControllers.prepareAndRun(process.argv.slice(2));

  }

})();
