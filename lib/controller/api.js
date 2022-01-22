const {
  httpController,
} = require('./http');

module.exports = {
  apiController: (name, ctx) => httpController(`${name}Api`, ctx),
}
