module.exports = [
  'collection',
  'data',
  'date',
  'dev',
  'domain',
  'encryption',
  'error',
  'file',
  'logic',
  'map',
  'process',
  'rand',
  'ssl',
  'string',
  'type',
  'validate',
].reduce((exp, name) => ({
  ...exp,
  [name] : require(`./${name}`),
}), {});