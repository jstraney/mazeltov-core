module.exports = ( ctx = {} ) => {

  const {
    services,
  } = ctx;

  const {
    viewService,
  } = services;

  return {
    'view link': {
      consumer: viewService.link,
      description: [
        'Symbolically link a modules views to your project.',
        'This will symlink that modules "view" directory to your',
        'own as the modules name. Be sure to add this directory',
        'to your apps "views" setting in web middleware',
      ].join(' '),
      options: [
        { name: 'module', type: String, defaultOption: true},
      ],
    },
    'view unlink': {
      consumer: viewService.unlink,
      description: [
        'Removes symlinked module views',
      ].join(' '),
      options: [
        { name: 'module', type: String, defaultOption: true},
      ],
    },

  };
};
