module.exports = ( ctx = {} ) => {

  const {
    services,
  } = ctx;

  const {
    seedService,
  } = services;

  return {
    'seed run': {
      consumer: seedService.run,
      description: [
        'Run seeders for your project',
      ].join(' '),
      options: [
        { name: 'name', type: String, defaultOption: true },
        { name: 'all', type: Boolean },
      ],
    },
    'seed make': {
      consumer: seedService.make,
      description: [
        'Makes a new project seeder file',
      ].join(' '),
      options: [
        { name: 'name', type: String, defaultOption: true },
      ],
    },
  };
};
