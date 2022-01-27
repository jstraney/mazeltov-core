const fs = require('fs').promises;
const path = require('path');

const { existsSync } = require('fs');

module.exports = ( ctx ) => {

  const {
    loggerLib,
    services: {
      dbService: db,
      projectService: {
        isInProjectDir,
      },
    },
  } = ctx;

  const logger = loggerLib(`@mazeltov/core/service/seed`);

  const make = async ( args ) => {

    const {
      name,
    } = args;

    const baseDir = process.cwd();

    if (!isInProjectDir(baseDir)) {
      logger.error('Making seeders requires being in a project directory');
    }

    const seedDir = path.join(baseDir, 'seed');

    if (!existsSync(seedDir)) {
      logger.error('No "seed" directory found in project');
    }

    const envDir = process.env.NODE_ENV === 'production'
      ? 'prod'
      : 'dev';

    const seedEnvDir = path.join(seedDir, envDir);

    if (!existsSync(seedEnvDir)) {
      logger.error('No "seed" directory found in project for %s environment', envDir);
    }

    const template = [
    '// migration code here. no need to commit',
    '// try catch, or rollback transaction.',
    'module.exports = async (trx) => {',
    '};',
    ].join('\n');

    await fs.writeFile(path.join(seedEnvDir, `${name}.js`), template);

    logger.info(`Created new %s seeder: %s`, envDir, name);

  }

  const run = async ( args ) => {

    const {
      name,
      moduleName = null,
      all = false,
    } = args;

    if (!all && !name) {
      logger.error('Name or --all flag is required to run seeders');
      return;
    }

    const baseDir = process.cwd();

    if (!isInProjectDir(baseDir)) {
      logger.error('Making seeders requires being in a project directory');
    }

    const modulePath = moduleName
      ? projectService.getModulePath(baseDir, moduleName)
      : null;

    const seedDir = modulePath
      ? path.join(baseDir, 'node_modules', moduleName, 'seed')
      : path.join(baseDir, 'seed');

    if (!existsSync(seedDir)) {
      logger.error('No "seed" directory found in project');
    }

    const envDir = process.env.NODE_ENV === 'production'
      ? 'prod'
      : 'dev';

    const seedEnvDir = path.join(seedDir, envDir);

    if (!existsSync(seedEnvDir)) {
      logger.error('No "seed" directory found in project for %s environment', envDir);
    }

    const trx = await db.transaction();

    if (all) {

      const seederFiles = await fs.readdir(seedEnvDir);

      if (!seederFiles.length) {
        logger.info('No seeders found in %s', seedEnvDir);
        return;
      }

      for (const file of seederFiles) {
        const fullPath = path.join(seedEnvDir, file);
        const seeder = require(fullPath);
        try {
          await seeder(trx)
          logger.info('Seeder %s completed', file);
        } catch (error) {
          logger.error('%o', error);
          logger.error('Seeders failed to complete at %s', file);
          await trx.rollback();
          return;
        }
      }

      await trx.commit();

      return;

    }

    // normalize the name passed through cli
    const fileName = /\.js$/.test(name)
      ? name
      : `${name}.js`;

    const seederFile = path.join(seedEnvDir, fileName);

    if (!existsSync(seederFile)) {
      logger.info('No seeders found in %s', seedEnvDir);
      return;
    }

    const seeder = require(seederFile);

    try {
      await seeder(trx);
      await trx.commit();
      logger.info('Seeder %s completed', fileName);
    } catch (error) {
      logger.error('%o', error);
      logger.error('Seeders failed to complete at %s', file);
      await trx.rollback();
      return;
    }

  }

  return {
    make,
    run,
  };
}
