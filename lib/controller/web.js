const {
  httpController,
} = require('./http');

module.exports = {
  webController: (name, ctx) => httpController(`${name}Web`, ctx),
}
