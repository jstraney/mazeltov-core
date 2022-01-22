module.exports = ( ctx = {} ) => {

  const {
    services,
  } = ctx;

  const {
    moduleService,
  } = services;

  return {
    'module install': {
      consumer: moduleService.install,
      description: [
        'Install a mazeltov module which is just a node package that',
        'follows a semantic structure',
      ].join(' '),
      options: [
        { name: 'moduleName', type: String, defaultOption: true },
        { name: 'pathPrefix', type: String },
      ],
    },
    'module uninstall': {
      consumer: moduleService.uninstall,
      description: [
        'Uninstall a mazeltov module'
      ].join(' '),
      options: [
        { name: 'moduleName', type: String, defaultOption: true },
        { name: 'pathPrefix', type: String },
      ],
    },
  };

};
