if (!global) {
  window.global = window;
}
// Webpack will try to load EVERYTHING that could
// be imported if a dynamic import is used. It's important
// then to explicity require submodules from here and
// require it from your webpack project like
// require('@mazeltov/util/webpack');
module.exports = {
  collection: require('./collection'),
  error: require('./error'),
  domain: require('./domain'),
  func: require('./func'),
  string: require('./string'),
  validate: require('./validate'),
  logic: require('./logic'),
  map: require('./map'),
  type: require('./type'),
};
