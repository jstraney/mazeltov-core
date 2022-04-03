const {
  httpController,
} = require('./http');

module.exports = {
  apiController: (name, ctx) => httpController(name, ctx, 'api'),
}
