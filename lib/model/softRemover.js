const updater = require('./updater');

module.exports = ( ctx = {} ) => updater({
  ...ctx,
  fnName: 'softRemove',
  updateArgs: {},
  defaultUpdateArgs: {
    deletedAt: true,
  },
});

