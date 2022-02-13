module.exports = ( ctx ) => {

  const {
    services: {
      settingService: {
        getSetting,
      },
    },
  } = ctx;

  return {
    'setting get': {
      consumer: ({ name }) => getSetting(name),
      options: [
        { name: 'name', type: String, defaultOption: true },
      ],
    },
  };
};
