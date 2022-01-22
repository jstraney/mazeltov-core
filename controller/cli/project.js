module.exports = ( ctx = {} ) => {

  const {
    services,
  } = ctx;

  const {
    projectService,
  } = services;

  return {
    'project create': {
      consumer: projectService.create,
      description: 'Create a new Mazeltov project',
      options: [
        { name: 'name', type: String, defaultOption: true},
        { name: 'pathPrefix', type: String, defaultValue: '.' },
        { name: 'skipPrompt', alias: 's', type: Boolean, defaultValue: false},
      ],
    },
    'project setup': {
      consumer: projectService.setup,
      description: [
        'Sets up project .env and local cryptographic files.',
        'most useful for starting up a cloned repo.',
      ].join(' '),
      options: [
        { name: 'path', type: String, defaultOption: true, defaultValue: '.'},
        { name: 'skipPrompt', alias: 's', type: Boolean, defaultValue: false},
      ],
    },
  };
};
