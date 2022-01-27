const
fs   = require('fs'),
path = require('path');

const { execSync } = require('child_process');

module.exports = ( ctx = {} ) => {

  const {
    loggerLib,
    services: {
      dbService: db,
      migrationService,
      viewService,
      projectService,
    },
  } = ctx;

  const logger = loggerLib('@mazeltov/cli/service/module');

  const moduleOnFS = (moduleName) => /^\/|[.]{1,2}/.test(moduleName);

  // change anything on FS and on DB when installing/updating module
  const installSideEffects = async ( args = {} ) => {

    let {
      currPath,
      passedName,
      moduleName,
      upgrade = false,
    } = args;

    let isSymlinked = false;

    // if installed from FS. get the actual module name from its
    // package.json for resolving within own node_modules
    if (moduleOnFS(moduleName)) {
      packageJSON = require(path.resolve(moduleName, 'package.json'));
      logger.info('%s on file path. grabbing name from package', moduleName);
      moduleName = packageJSON.name;
      isSymlinked = true;
    }

    logger.info('Updating database for %s', moduleName);

    const modulePath = path.join(currPath, 'node_modules', moduleName);

    const pkgPath = path.join(modulePath, 'package.json');

    // Check if should be treated as a mazeltov module
    if (!fs.existsSync(pkgPath)) {
      return false;
    }

    const pkg = require(pkgPath);

    const isOfMazeltov = !!(pkg.generatedWith === 'mazeltov');

    if (!isOfMazeltov) {
      logger.warn([
        '%s doesn\'t look like a mazeltov module as it\'s missing',
        '"generatedWith": "mazeltov" from its package.json. It was installed',
        'as a node module but migrations, views and other steps are',
        'being skipped.',
      ].join(' '), passedName);
      return;
    }

    const controllerPath = path.join(modulePath, `controller/index.js`);
    const hasControllers = fs.existsSync(controllerPath);

    const servicePath = path.join(modulePath, `service/index.js`);
    const hasServices = fs.existsSync(servicePath);

    // check if there are migrations and link
    const migrationPath = path.join(modulePath, `migrate`);
    const hasMigrations = fs.existsSync(migrationPath);

    if (hasMigrations) {
      try {
        await migrationService.run({
          moduleName,
        });
      } catch (error) {
        logger.error('%o', error);
        logger.error('Error trying to run migrations for %s', passedName);
        logger.error([
          'The module is most likely in a broken state now which should be',
          'fixed by reviewing the errors and rerunning the module migrations',
        ].join(' '))
      }
    }

    // check if there are views and link
    const viewPath = path.join(modulePath, `view`);
    const hasViews = fs.existsSync(viewPath);

    if (hasViews) {
      await viewService.link({
        moduleName,
      });
    }

    const assetPath = path.join(modulePath, `asset`);
    const hasAssets = fs.existsSync(assetPath);

    // check if there are views and link
    const modelPath = path.join(modulePath, `model`);
    const hasModels = fs.existsSync(modelPath);

    await db('module')
      .withSchema('mazeltov')
      .insert({
        name: moduleName === 'core' ? 'core' : moduleName,
        hasMigrations,
        hasAssets,
        hasViews,
        hasServices,
        hasModels,
        hasControllers,
        isInstalled: true,
        isEnabled: true,
        isSymlinked,
      })
      .onConflict('name')
      .merge();

    // allow code to run when installing the service
    const installServicePath = path.join(modulePath, 'service/install.js');
    const hasInstallService = fs.existsSync(installServicePath);

    if (hasInstallService && !upgrade) {
      const installService = require(installServicePath);
      await installService(ctx);
    }

    // TODO: upgrade service hooks? Maybe something like...
    // if (upgrade) {
    //   const upgradeServicePath = path.join(modulePath, 'service/upgrade.js');
    //   const hasUpgradeService = fs.existsSync(upgradeServicePath);
    //   if (hasUpgradeService) {
    //     const version = pkg.version.replace(/\./g, '_');
    //     const upgradeService = require(upgradeServicePath);
    //     // e.g. upgrade__2_0_3
    //     if (version && isFunction(upgradeService[`upgrade__${version}`])) {
    //       upgradeService[`upgrade__${version}`](ctx);
    //     }
    //   }
    // }

  }

  const install = async ( args = {} ) => {

    const {
      moduleName: passedName,
      pathPrefix = '.',
    } = args;

    const currPath = path.resolve(process.cwd(), pathPrefix);

    if (!projectService.isInProjectDir(currPath)) {
      const pathLabel = currPath === '.'
        ? 'Current directory'
        : currPath;
      throw new Error(`${pathLabel} is not a Mazeltov project`);
    }

    // support for npm via file paths
    const moduleName = moduleOnFS(passedName)
      ? passedName
      : projectService.getTranslatedModuleName(passedName);

    execSync(`npm i -s ${moduleName} --prefix ${currPath}`, { stdio: 'pipe'});

    await installSideEffects({
      currPath,
      passedName,
      moduleName
    });

  };

  const uninstall = async ( args = {} ) => {

    const {
      moduleName: passedName,
      pathPrefix = '.',
    } = args;

    const currPath = path.resolve(process.cwd(), pathPrefix);

    // support for npm via file paths
    const moduleName = moduleOnFS(passedName)
      ? passedName
      : projectService.getTranslatedModuleName(passedName);

    const modulePath = path.join(currPath, `node_modules/${moduleName}`);

    const [ record ] = await db('module')
      .withSchema('mazeltov')
      .where({ name: passedName });

    // check if there are views and unlink
    if (record.hasViews) {
      await viewService.unlink({
        moduleName,
      });
    }

    // check if there are migrations and unlink
    if (record.hasMigrations) {
      await migrationService.rollback({
        moduleName,
        all: true,
      });
    }

    // uninstall npm module from dir
    execSync(`npm uninstall ${moduleName} --prefix ${currPath}`, { stdio: 'pipe'});

    await db('module')
      .withSchema('mazeltov')
      .update({
        isInstalled: false,
        isEnabled: false,
      })
      .where({
        name: moduleName
      });

    logger.info('Uninstalled npm package %s', moduleName);

    // allow code to run when installing the service
    const unistallServicePath = path.join(modulePath, 'service/uninstall.js');
    const hasUninstallService = fs.existsSync(uninstallServicePath);

    if (hasUninstallService) {
      const uninstallService = require(uninstallServicePath);
      await uninstallService(ctx);
    }

  };

  const update = async ( args = {} ) => {

    const {
      moduleName: passedName,
      pathPrefix = '.',
    } = args;

    const currPath = pathPrefix;

    // support for npm via file paths
    const moduleName = moduleOnFS(passedName)
      ? passedName
      : projectService.getTranslatedModuleName(passedName);

    // run npm install@latest for module
    execSync(`npm install@latest ${moduleName} --prefix ${currPath}`, { stdio: 'pipe' });

    // update links for migrations and views
    await installSideEffects({
      currPath,
      passedName,
      moduleName,
      upgrade: true,
    });

  };

  const getEnabledModules = async () => {
    return db('module')
      .withSchema('mazeltov')
      .where({ isEnabled: true });
  };

  return {
    getEnabledModules,
    install,
    uninstall,
    update,
  };

}
