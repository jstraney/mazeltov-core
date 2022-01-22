const updater = require('./updater');

module.exports = ( ctx = {} ) => updater({
  ...ctx,
  fnName: 'softRestore',
  updateArgs: {},
  defaultUpdateArgs: {
    deletedAt: false,
  },
});

