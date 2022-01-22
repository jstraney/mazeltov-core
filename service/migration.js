const
fs   = require('fs').promises,
path = require('path');

const existsSync = require('fs').existsSync;

const {
  DateTime,
} = require('luxon');

const {
  collection: {
    arrayIntersect,
    arrayDiff,
  },
} = require('../lib/util');

const prompt = require('prompt');

module.exports = ( ctx = {} ) => {

  const {
    loggerLib,
    services: {
      dbService: db,
      projectService,
    },
  } = ctx;

  const logger = loggerLib('@mazeltov/cli/service/migration');

  const getMigrationFiles = async (baseDir, moduleName) => {

    const modulePath = projectService.getModulePath(baseDir, moduleName)
    const migrationDirPath = path.join(modulePath, `/migrate`);
    const migrations = await fs.readdir(migrationDirPath);

    return migrations.sort().map((name) => {
      return [name, require(path.join(migrationDirPath, name))];
    });

  }

  const make = async ( args ) => {

    const {
      name,
    } = args;

    const baseDir = process.cwd();

    const migrationDir = path.join(baseDir, 'migrate');

    if (!existsSync(migrationDir)) {
      logger.info('creating migration directory at ./migrate');
      await fs.mkdir(migrationDir);
    }

    const filename = DateTime.now().toFormat(`yyyyLLddHHmmss_'${name}.js'`);

    // somewhat like the knex migration template but async by default
    // and also clarifies that a transaction is passed in (so no need to
    // make your own with commit/rollback since postgres is the default
    // database which allows trx on schema changes)
    const template = [
    'exports.up = async (trx) => {',
    '',
    '};',
    '',
    'exports.down = async (trx) => {',
    '',
    '};',
    ].join('\n');

    const fullPath = path.join(migrationDir, filename);

    await fs.writeFile(fullPath, template);

    logger.info('Made new migration at %s', fullPath);

  };

  /**
   * Same as 'latest' in other migration systems. Will skip
   * migrations so long as they have been run in order already
   * and will run whatever hasn't been run for a module.
   */
  const run = async ( args ) => {

    const {
      moduleName,
      prefix = '.',
      steps = null,
    } = args;

    await bootstrapMigrations();

    const baseDir = path.resolve(process.cwd(), prefix);
    const migrationFiles = await getMigrationFiles(baseDir, moduleName);

    const migrationRecords = await db('migration')
      .withSchema('mazeltov')
      .where('moduleName', moduleName)
      .orderBy('name', 'asc');

    const trx = await db.transaction();

    // so long as there is no break in what is "up", the migrations
    // are skipped. but if some are "down" and one down the road is
    // "up" in the database, an error is shown.
    const skipped = [];
    const couldBeRun = [];

    for (let i = 0; i < migrationFiles.length; i++) {
      const migrationRecord = migrationRecords[i] || null;
      const [name, migration] = migrationFiles[i];
      if (migrationRecord !== null && migrationRecord.name != name) {
        logger.error([
          'Migration mismatch for %s. Found %s in database for migration #%s',
          'but found %s on file system. Roll back and remove',
          'the migration from the database before renaming or changing migration',
          'files.',
        ].join(' '), moduleName, migrationRecord.name, i, name);
        return;
      }
      const alreadyRan = migrationRecord !== null && migrationRecord.status === 'up';
      if (alreadyRan && i === skipped.length) {
        logger.debug('%s:%s in status of "up", skipping ahead.', moduleName, name);
        skipped.push([name, migration]);
        continue;
      } else if (alreadyRan) {
        logger.error([
          '%s:%s has a state of "up" even though migrations before it',
          'have been designated to be run (status of "notRun", or "down").',
          'This could be a corrupted state in migrations and is resolved',
          'by rolling back this migration or removing it.',
        ].join(' '), moduleName, name);
        return;
      }
      couldBeRun.push([name, migration]);
    }

    if (!couldBeRun.length) {
      logger.info('Nothing to run')
      return;
    }

    const migrationRun = {
      moduleName,
      direction: 'up',
    };

    const toBeRun = steps === null
      ? couldBeRun
      : couldBeRun.slice(0, steps);

    const [fst] = toBeRun;
    migrationRun.startedAt = fst[0];

    for (const [name, migration] of toBeRun) {
      try {
        await migration.up(trx);
        await trx('migration')
          .withSchema('mazeltov')
          .insert({
            moduleName,
            name,
            status: 'up',
          })
          .onConflict(['moduleName', 'name'])
          .merge();
        logger.info('%s:%s migrated up (pending completion)', moduleName, name);
      } catch (error) {
        logger.error('Error from migration: %o', error);
        logger.error('Migration %s:%s failed. Rolling back migrations.', moduleName, name);
        await trx.rollback();
        migrationRun.failedAt = name;
        migrationRun.status = 'failed';
        await db('migrationRun')
          .withSchema('mazeltov')
          .insert(migrationRun);
        return;
      }
    }

    const [lst] = toBeRun.slice(-1);

    migrationRun.completedAt = lst[0];
    migrationRun.status = 'completed';

    await trx('migrationRun')
      .withSchema('mazeltov')
      .insert(migrationRun);

    await trx.commit();

  };

  /*
   * Will look at the last migrationRun record and rollback in order.
   * by comparison, down and up will not use the migrationRun table
   * at all and will go off of the migration status to run the next one.
   */
  const rollback = async ( args ) => {

    const {
      moduleName,
      steps = null,
      all = false,
    } = args;

    await bootstrapMigrations();

    const allModuleMigrations = await db('migration')
      .withSchema('mazeltov')
      .where({
        moduleName,
      })
      .orderBy('name', 'asc');

    const migrationNames = allModuleMigrations.map(({name}) => name);

    const order = allModuleMigrations.reduce((lookup, row, i) => ({
      ...lookup,
      [row.name]: i,
    }), {});

    // if a run to rollback a set of migrations
    // was successful, we want to actually rollback
    // the one prior to that.
    const runs = await db('migrationRun')
      .withSchema('mazeltov')
      .where({
        moduleName,
        status: 'completed',
      })
      .orderBy('createdAt', 'desc');

    let lastDown = [];

    for (const row of runs) {
      if (row.direction === 'down' && row.status === 'completed') {
        const {startedAt, completedAt} = row;
        const i = order[startedAt];
        const j = order[completedAt];
        lastDown = migrationNames.slice(j, i + 1);
        continue;
      }
      if (row.direction === 'up' && row.status === 'completed') {
        const {startedAt, completedAt} = row;
        const i = order[startedAt];
        const j = order[completedAt];
        const lastUp = migrationNames.slice(i, j + 1);
        const diff = arrayDiff(lastUp, lastDown)
        if (diff.length) {
          const fst = diff[0];
          const lst = diff.pop();
          lastRun = {
            completedAt: lst,
            startedAt: fst,
          };
          break;
        }
      }
    }

    if (lastRun === null) {
      logger.info('No migration runs to roll back');
      return;
    }

    const {
      startedAt,
      completedAt,
      failedAt,
    } = lastRun;

    const baseDir = process.cwd();
    const migrationFiles = (await getMigrationFiles(baseDir, moduleName)).reverse();

    const migrationRecords = await db('migration')
      .withSchema('mazeltov')
      .where('moduleName', moduleName)
      .orderBy('name', 'desc');

    const skipped = [];
    const toBeRolledBack = [];
    const justOne = startedAt === (completedAt);

    for (let i = 0; i < migrationRecords.length; i++) {
      const record = migrationRecords[i];
      const [name, migration] = migrationFiles[i];
      const inRollback = toBeRolledBack.length > 0;
      const notRun = ['notRun', 'down'].includes(record.status);
      const hasRun = record.status === 'up';
      if (name !== record.name) {
        logger.error([
          'Migration record for %s:%s found, but doesnt match',
          'the migration file name %s. Most likely the migration',
          'file was deleted but you have to remove the database',
          'record manually to fix this.',
        ].join(' '), moduleName, record.name, name);
        return;
      }
      if (all === true) {
        hasRun && toBeRolledBack.push([name, migration])
        continue;
      }
      if (!inRollback && notRun) {
        skipped.push(name);
        continue;
      } else if (inRollback && notRun) {
        logger.warn([
          '%s:%s is in the middle of this rollback and shows as a status of',
          '"%s" when it is expected to be "up". This could indicate a corrupted',
          'state in migrations but is being skipped.',
        ].join(' '), moduleName, name, record.status);
        skipped.push(name);
      }
      if (!inRollback && name === completedAt) {
        toBeRolledBack.push([name, migration]);
        // if the first and last migration are the same, we can exit now.
        if (justOne) {
          break;
        } else if (steps !== null && steps == toBeRolledBack.length) {
          break;
        }
      } else if (inRollback && name === startedAt) {
        toBeRolledBack.push([name, migration]);
        break;
      } else if (inRollback && hasRun) {
        toBeRolledBack.push([name, migration]);
        if (steps !== null && steps == toBeRolledBack.length) {
          break;
        }
      }
    }

    if (!toBeRolledBack.length) {
      logger.info('Nothing to rollback')
      return;
    }

    const [fst] = toBeRolledBack;

    const migrationRun = {
      moduleName,
      direction: 'down',
      startedAt: fst[0],
    };

    const trx = await db.transaction();

    for (const [name, migration] of toBeRolledBack) {
      try {
        await migration.down(trx);
        await trx('migration')
          .withSchema('mazeltov')
          .where({
            moduleName,
            name,
          })
          .update({
            status: 'down',
          });
        logger.info('%s:%s migrated down (pending completion)', moduleName, name);
      } catch (error) {
        logger.error('Could not rollback %s:%s. undoing rollback.', moduleName, name);
        await trx.rollback();
        migrationRun.failedAt = name;
        migrationRun.status = 'failed';
        await db('migrationRun')
          .withSchema('mazeltov')
          .insert(migrationRun);
        return;
      }
    }

    const [lst] = toBeRolledBack.slice(-1);
    migrationRun.completedAt = lst[0];
    migrationRun.status = 'completed';

    await trx('migrationRun')
      .withSchema('mazeltov')
      .insert(migrationRun);

    await trx.commit();

  };

  /*
   * This is like a special, inline migration that should be considered
   * the base core migration that has to run before anything else.
   * This will run automatically if ever the tables do not exist.
   *
   * Any future changes to mazeltov.migration and mazeltov.migrationRun
   * should be done in normal migrations in core.
   */
  const bootstrapMigrations = async () => {

    const hasMigrationTable = await db.schema
      .withSchema('mazeltov')
      .hasTable('migration')
      .catch((error) => {
        logger.error('%o', error);
        return false;
      });

    const hasMigrationRunTable = await db.schema
      .withSchema('mazeltov')
      .hasTable('migration_run')
      .catch((error) => {
        logger.error('%o', error);
        return false;
      });

    if (hasMigrationTable && hasMigrationRunTable) {
      return;
    }

    logger.info('Couldn\'t find mazeltov.migration table. Building table');

    const trx = await db.transaction();

    try {

      await trx.raw('CREATE SCHEMA IF NOT EXISTS mazeltov');

      if (!hasMigrationTable) {
        await trx.schema
        .withSchema('mazeltov')
        .createTable('migration', (table) => {

          table.comment([
            'Migrations in mazeltov use knex migrations as',
            'a base, but rely on different tables to allow',
            'separate lines of migrations to run per module. The main method',
            'to allow this is to always namespace the migrations',
            'within schemas and only relate across schemas when',
            'absolutely necessary.',
          ].join(' '));

          table.text('moduleName')
            .notNullable();

          table.text('name')
            .notNullable();

          table.primary(['moduleName', 'name']);

          table.text('status')
            .notNullable()
            .defaultTo('notRun');

          table.timestamps(true, true);

        })

      }
      if (!hasMigrationRunTable) {
        await trx.schema
        .withSchema('mazeltov')
        .createTable('migrationRun', (table) => {

          table.comment([
            'Each time a migration is run for a module, it is recorded',
            'in this table. This allows migrations for a specific module',
            'to be run back',
          ].join(' '));

          table.increments('id');

          table.text('moduleName')
            .notNullable();

          table.text('failedAt')
            .nullable()

          table.text('startedAt')
            .nullable()

          table.text('completedAt')
            .nullable()

          table.text('status')
            .notNullable();

          table.text('direction')
            .notNullable();

          table.timestamps(true, true);

        });

      }
      await trx.commit();
      return true;
    } catch (error) {
      logger.error('%o', error)
      await trx.rollback();
      throw error;
    }

  };

  const up = async ( args ) => {
    return run({
      ...args,
      steps: 1,
    });
  };

  const down = async ( args ) => {
    return rollback({
      ...args,
      steps: 1,
    });
  };

  return {
    make,
    run,
    rollback,
    up,
    down,
  };

}
