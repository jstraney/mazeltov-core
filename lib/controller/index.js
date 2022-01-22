module.exports = [
  'util',
  'http',
  'web',
  'api',
].reduce((exports, name) => ({
  ...exports,
  ...(require(`./${name}`)),
}), {});
