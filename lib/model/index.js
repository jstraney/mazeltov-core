/*
 * RFC: standardized hooks and options for model method generators
 *
 * key: a string or array of strings for entity unique identifers
 * fnName: you can override the function name. This is useful for the
 *   modelFromContext helper. Note that the helper will append the
 *   entity name to this function name. (e.g. get becomes getPerson)
 * onWill<action> : maps the createArgs, updateArgs, getArgs, listArgs
 * on<action>Result : maps result from get, create, update, list
 * selectColumns: an array that is passed to _makeSelectArgs
 * createColumns: an array of keys that are reduced from args on create
 * updateColumns: an array of keys that are reduced from args on update
 * joins: joins is an array of arrays that describes the joins when
 *   selecting results
 *
 * get,remove,update uses the the key(s) of the entity but SHOULD accept
 * an array of uniqueColumns containing column names or column tuples
 * (nested arrays)
 */
module.exports = [
  'bulkCreator',
  'bulkMerger',
  'bulkPuter',
  'bulkRemover',
  'bulkUpdater',
  'creator',
  'getter',
  'introspector',
  'iser',
  'iterator',
  'lister',
  'merger',
  'remover',
  'softRemover',
  'softRestorer',
  'subjectAuthorizer',
  'suggester',
  'updater',
  'validator',
].reduce((exports, name) => ({
  ...exports,
  [name]: require(`./${name}`),
}), require('./util'));
