const
fs   = require('fs').promises,
path = require('path');

const existsSync = require('fs').existsSync;

module.exports = ( ctx = {} ) => {

  const {
    loggerLib,
    services = {},
  } = ctx;

  const {
    projectService,
  } = services;

  const logger = loggerLib('@mazeltov/cli/service/view');

  const link = async ( args = {} ) => {

    const {
      moduleName = null,
    } = args;

    if (!moduleName) {
      throw new Error('Cannot symbolically link views without a module');
    }

    if (!projectService.isInProjectDir(process.cwd())) {
      throw new Error('You must be in a project directory for this command to work');
    }

    const baseDir = process.cwd();

    const modulePath = moduleName === 'core'
      ? path.join(baseDir, 'node_modules/@mazeltov/core/view')
      : path.join(baseDir, 'node_modules/', moduleName, '/view');

    const linkPath = path.join(baseDir, 'view', moduleName);

    const linkPathParts = linkPath.split('/');

    if (linkPathParts.length > 1) {
      const rootPath = linkPathParts.slice(0, -1).join('/');
      await fs.mkdir(rootPath, { recursive: true, mode: 0o755 }).catch((error) => {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      });
    }

    // if file exists, skip. Allows updating new symlinked migrations
    if (existsSync(linkPath)) {
      logger.info('%s exists. skipping.', linkPath)
    } else {
      await fs.symlink(modulePath, linkPath, 'dir');
    }

    logger.info('Successfully linked %s view dir to %s', moduleName, linkPath);

  };

  const unlink = async ( args = {} ) => {

    const {
      moduleName = null,
      pathPrefix = '.',
    } = args;

    if (!moduleName) {
      throw new Error('Cannot symbolically link views without a module');
    }

    if (!projectService.isInProjectDir(process.cwd())) {
      throw new Error('You must be in a project directory for this command to work');
    }

    const baseDir = path.resolve(process.cwd(), pathPrefix);

    // for any module containing a slash (e.g. @mazeltov/access), leave the parent
    // directories in case another module has its views symlinked
    const linkPath = path.join(baseDir, '/view/', moduleName);

    await fs.unlink(linkPath);

    logger.info('Removed views at %s', linkPath);

  };

  return {
    link,
    unlink,
  };

}
