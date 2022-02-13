module.exports = ( ctx = {} ) => {

  const {
    services,
  } = ctx;

  const {
    migrationService,
  } = services;

  return {
    'migration run': {
      consumer: migrationService.run,
      description: [
        'Run migrations for a specific Mazeltov module',
      ].join(' '),
      options: [
        { name: 'moduleName', type: String, defaultOption: true, defaultValue: 'app' },
        { name: 'steps', type: Number, defaultOption: null },
      ],
    },
    'migration rollback': {
      consumer: migrationService.rollback,
      description: [
        'Rollback last batch of migrations that had been run',
      ].join(' '),
      options: [
        { name: 'moduleName', type: String, defaultOption: true, defaultValue: 'app' },
        { name: 'steps', type: Number, defaultOption: null },
      ],
    },
    'migration up': {
      consumer: migrationService.up,
      description: [
        'Run the next migration file for a module that has',
        'yet to be run. Shortcut for `migration run --steps 1`',
      ].join(' '),
      options: [
        { name: 'moduleName', type: String, defaultOption: true, defaultValue: 'app' },
      ],
    },
    'migration down': {
      consumer: migrationService.down,
      description: [
        'Roll back the last migration file for a module that has',
        'been run. Shortcut for `migration rollback --steps 1`',
      ].join(' '),
      options: [
        { name: 'moduleName', type: String, defaultOption: true, defaultValue: 'app' },
      ],
    },
    'migration make': {
      consumer: migrationService.make,
      description: [
        'Create a new migration file for the current project'
      ].join(' '),
      options: [
        { name: 'name', type: String, defaultOption: true }
      ],
    },
  };
};
