const fs = require('fs');
const path = require('path');

/**
 * Template Service Interface
 *
 * constructor
 * @param object - config
 * @property templateDir
 * @property logger (logger library. defaults to console)
 * @property ...rest anything else an inheriting service uses
 *
 * compile
 * @param string - file path
 * @param alias - a shorthand to pass to renderer later
 * @return function - Renderer function
 *
 * render
 * @param string - template alias (relative path from templateDir by default)
 * @param object - locals passed to renderer
 *
 * Renderer interface (callable)
 *
 * call to self
 * @param object - locals
 */
const pugTemplateService = ( ctx = {} ) => {

  const {
    templateServiceConfig: {
      templateDir,
      pug,
    },
    loggerLib,
  } = ctx;

  const logger = loggerLib('@mazeltov/service/template');

  const isDevelopment = process.env.NODE_ENV === 'development';

  const templates = {};

  const compile = (relativePath, alias = relativePath) => {
    if (isDevelopment || !templates[alias]) {
      try {
        if (!templates[relativePath]) {

          const nextPath = /\.pug$/.test(relativePath)
            ? relativePath
            : relativePath + '.pug';

          const fullPath = path.resolve(templateDir, nextPath);
          // we are using readSync because we do not want requests
          // to come in to render templates that have not loaded yet.
          const contents = fs.readFileSync(fullPath);
          fn = pug.compile(contents, { filename: fullPath });
          if (alias != relativePath) {
            templates[alias] = fn;
          } else {
            templates[relativePath] = fn;
          }
        } else {
          templates[alias] = templates[relativePath];
        }
      } catch (error) {
        logger.error('Template failed to load: %o', error);
      }
      return;
    }
    logger.debug('Template already loaded with alias: %s', alias);
  }

  // remember that the alias is the relative path from template dir by default
  const render = (alias, locals) => {
    // always re-compile while in development
    if (isDevelopment) {
      logger.debug('Compiling fresh template in development mode');
      compile(alias);
    } else if (!templates[alias]) {
      // try a compile on first render (explicit call to render not necessary)
      compile(alias);
    }
    if (templates[alias]) {
      return templates[alias](locals);
    } else {
      logger.error('Template cannot render as the renderer was never compiled');
      return '';
    }
  }

  return {
    compile,
    render,
  };

}

/**
 * Now if we have templates that use ejs, handlebars,
 * or some JSON/code templating, we can use the same common interface
 */
module.exports = ( ctx = {} ) => {

  const {
    appRoot,
    templateServiceConfig = {},
  } = ctx;

  const {
    type = 'pug',
    templateDir = path.join(appRoot, 'view'),
  } = templateServiceConfig;

  if (!templateDir) {
    throw new Error('templateDir is required for template service');
  }

  switch (type) {
    case 'pug':
    default:
      return pugTemplateService(ctx);
  }

}
