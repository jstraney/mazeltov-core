const chalk = require('chalk');

const {
  type: {
    isArray,
    isString,
  },
  string: {
    pascalCase,
  },
} = require('../lib/util');

const
cliArgs = require('command-line-args'),
cliUsage = require('command-line-usage');

module.exports = ( ctx ) => {

  const {
    loggerLib,
    services: {
      controllerService,
      hookService: {
        hook,
        redux,
        onRedux,
      },
      routeService: {
        routeInfo: getRouteInfo,
      },
      settingService: {
        getSetting,
      },
    },
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/cliController');

  onRedux('cliOptionType', (_, psqlType) => {
    switch (psqlType) {
      case 'boolean':
        return Boolean;
      case 'smallint':
      case 'integer':
      case 'bigint':
      case 'decimal':
      case 'numeric':
      case 'real':
      case 'double precision':
      case 'small serial':
      case 'serial':
      case 'bigserial':
        return Number;
      case 'character':
      case 'character varying':
      case 'text':
      default:
        return String;
    }
  });

  /**
   * The automagic way of building console commands is highly experimental and
   * I cannot recommend enough to just write them yourself under controller/cli
   */
  onRedux('cliOptions', (_, action, entityInfo) => {

    const columnNameToOption = (name) => {
      const psqlType = entityInfo.columnInfo[name];
      const type = redux('cliOptionType', psqlType);
      return {
        name,
        type,
      };
    };

    const options = entityInfo.columns.map(columnNameToOption);
    const keyOptions = options.filter(({name}) => entityInfo.key.includes(name));

    // TODO: this needs improvement. get and remove should work flawlessly
    // but the following three are a little cludgy atm.
    switch (action) {
      case 'get':
      case 'remove':
        return keyOptions;
      case 'update':
      case 'create':
      case 'list':
        return options;
      default: return [];
    }
  });

  const APP_NAME = getSetting('app.name') || 'Mazeltov';

  onRedux('cliHelp', (_, action, entityInfo, options) => {

    const entityName = entityInfo.entityName;

    return [
      {
        header: `${APP_NAME} - ${entityName} ${action}`,
      },
      {
        header: 'Options',
        optionList: options,
      }
    ];

  });

  const mapOptionsToOptionsHelp = (options = []) => {

    // for each option used for command-line-args library, build
    // help for the command-line-usage library.
    return options.map((option) => {

      const nameArr = [option.name];

      option.alias && nameArr.push('-' + option.alias);

      const descriptionArr = [];

      option.description && descriptionArr.push(option.description);
      option.multiple && descriptionArr.push('multiple');
      option.defaultValue && descriptionArr.push('default=' + option.defaultValue);

      return {
        name: nameArr.join(', '),
        typeLabel: option.type.name || 'String',
        description: descriptionArr.join('|'),
      };

    });
  };

  const listCommands = () => {

    console.log(cliUsage([
      {
        header: 'Mazeltov - cli command help',
        content: [
          'Here are some commands you can run. Running the command',
          'with the --help flag will provide extended description and options',
        ].join(' '),
      },
      {
        header: 'Commands',
        content: Object.keys(commands).sort().map((name) => {

          const cmdInfo = commands[name] || {};

          const description = cmdInfo.description
            ? cmdInfo.description.slice(0, 50) + '...'
            : null;

          return description
            ? `${chalk.green(name)}: ${description}`
            : `${chalk.green(name)}`;

        }),
      }
    ]));
  }

  const prepareCli = (allCommands = {}) => {

    return async (args) => {

      if (!args.length) {
        listCommands();
        console.log(chalk.cyan('  mazeltov requires a command. Showing commands.'));
        hook('appHangup');
        process.exit(0);
      }

      const stack = [args.shift()];

      while (!allCommands[stack.join(' ')]) {

        const next = args.shift();

        if (next === undefined) {

          listCommands();

          console.log(chalk.red('  Unknown command "%s"'), stack.join(' '));

          hook('appHangup');
          process.exit(1);

        }

        stack.push(next);

      }

      const
      commandName = stack.join(' '),
      commandInfo = allCommands[commandName],
      subArgs = args;

      const {
        options = [],
        help = [],
        consumer = (a) => a,
        validator = null,
        description = '',
        hup = true,
      } = commandInfo;

      // certain things are pulled into the CLI help by default
      if (args.includes('--help')) {
        options && options.length && help.unshift({
          header: 'Options',
          optionList: mapOptionsToOptionsHelp(options),
        });
        help.unshift({
          header: 'Mazeltov - ' + commandName,
          content: description,
        })
        console.log(cliUsage(help));
        if (hup) {
          hook('appHangup');
        }
        return;
      }

      try {

        const parsedOptions = cliArgs(options, { argv: subArgs });

        if (validator) {
          await validator(parsedOptions);
        }

        const result = await consumer(parsedOptions);

        if (result) {
          console.log(result);
        }

      } catch (error) {

        console.error('%o', error);

      }

      // TODO: consider a core hook for process clean up on hang up
      // hup option allows you to to not kill certain connections
      // that will keep the process alive. For instance, the http server
      // requires a database and redis connection, but for other CLI
      // commands we want to destroy these so they don't keep process up
      if (hup) {
        hook('appHangup');
      }
    };

  };

  const commands = {};

  const registerCliControllers = (cliControllers = {}) => {
    for (const name in cliControllers) {
      if (!cliControllers.hasOwnProperty(name)) {
        continue;
      }
      commands[name] = cliControllers[name];
    }
  }

  const registerConsoleCommand = (name, commandInfo) => {
    commands[name] = commandInfo;
  };

  // prepares the cli and returns a function that accepts
  // an array of tokens (argv) and chooses a command to
  // run from the tokens.
  const prepare = () => prepareCli(commands)

  // prepares CLI commands and runs instantly
  const prepareAndRun = (argv) => prepare()(argv);

  const cliControllerParams = controllerService.subtypeControllerParams;

  const cliControllerLoadInstance = (loaderCtx, loader, name, actions, config) => {

    if (!name || !isString(name) || !isArray(actions)) {
      return null;
    }

    const {
      models: loadedModels,
    } = loaderCtx;

    const modelName = `${name}Model`;

    if (!loadedModels[modelName]) {
      logger.warn("%s is not a registered model. Skipping", modelName);
      return null;
    }

    const model = loadedModels[modelName];

    const {
      _entityInfo = null,
    } = model;

    if (!_entityInfo) {
      return null;
    }

    const {
      schema = APP_NAME,
      entityName,
    } = _entityInfo;

    if (!entityName) {
      logger.warn('_entityInfo.entityName is missing for %s', modelName);
      return null;
    }
    if (!schema) {
      logger.warn('_entityInfo.schema property is missing for %s', modelName);
      return null;
    }

    const addedRouteIds = {};

    actions.forEach((action) => {

      if (!model[action]) {
        logger.warn('%s does not have %s method', modelName, action);
        return null;
      }

      // TODO: replace with method call to core routeService
      const routeId = `${action}:${schema}.${entityName}`;

      const routeInfo = getRouteInfo(routeId, 'cli');

      const {
        uri = null,
        options = [],
        help = [],
      } = routeInfo;

      if (!uri) {
        logger.warn('No cli route for route id %s', routeId);
        logger.warn([
          'This is either because the route id is incorrect',
          'or because the route wasn\'t registered with',
          'onRedux(\'cliRoute\', cb) in a service. Defining',
          'a %s table with the %s schema should register the route id for you.',
        ].join(' '), entityName, schema);
        return null;
      }

      const commandDef = {
        options,
        help,
        consumer: model[action],
      };

      const pascalAction = pascalCase(action);

      if (model[`validate${pascalAction}`]) {
        commandDef.validator = model[`validate${pascalAction}`];
      }

      registerConsoleCommand(uri, commandDef);

      logger.debug('added cli command "%s"', uri)

      addedRouteIds[routeId] = true;

    });

    onRedux('cliRoute', (nextRoutes) => {
      for (routeId in addedRouteIds) {
        if (!addedRouteIds.hasOwnProperty(routeId)) {
          continue;
        }
        nextRoutes[routeId].enabled = true;
      }
      return nextRoutes;
    });

  };

  return {
    cliControllerParams,
    cliControllerLoadInstance,
    prepare,
    prepareAndRun,
    registerConsoleCommand,
    registerCliControllers,
    listCommands,
  };

}
