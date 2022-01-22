const getter = require('./getter');
/*
 * What is an iser? an iser checks if something IS something else.
 * It is actually just a getter! but the result is twice negated
 * to return a boolean. easy.
 */
module.exports = (ctx) => getter({
  fnName: 'is',
  onGetResult: (rowMaybeNull) => !!rowMaybeNull,
  ...ctx,
});


