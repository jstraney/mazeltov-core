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
      description: [
        'Create a new Mazeltov project. A project directory with the',
        'projects name is created in the current directory, but a prefix to',
        'this file path can be specified (e.g. /var/www or /home/user).',
        'A branch can be specified too to scaffold a project from a branch',
        'of the mazeltov-project repo.',
      ].join(' '),
      options: [
        { name: 'name', type: String, defaultOption: true},
        { name: 'pathPrefix', type: String, defaultValue: '.' },
        { name: 'skipPrompt', alias: 's', type: Boolean, defaultValue: false},
        { name: 'branch', alias: 'b', type: String, defaultValue: false},
      ],
    },
    'project setup': {
      consumer: projectService.setup,
      description: [
        'This set up a project that has been cloned so it may not have',
        'the .env file generated or other generated files. This calls each',
        'modules install service.',
      ].join(' '),
      options: [
        { name: 'path', type: String, defaultOption: true, defaultValue: '.'},
        { name: 'skipPrompt', alias: 's', type: Boolean, defaultValue: false},
      ],
    },
  };
};
