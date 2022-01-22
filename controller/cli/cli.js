module.exports = (ctx) => {

  const {
    services: {
      cliControllerService: {
        listCommands,
      },
    },
  } = ctx;

  return {
    help: {
      consumer: listCommands,
    },
    list: {
      consumer: listCommands,
      description: 'An alias for "help" command'
    },
  };
};
