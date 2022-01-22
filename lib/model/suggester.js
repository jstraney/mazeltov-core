const {
  collection: {
    objValueAggregateString,
    getIfSet,
  },
  type: {
    isFunction,
    isNull,
  },
} = require('../util');

const {
  _makeKeys,
} = require('./util');

const lister = require('./lister');

/*
 * A suggester flavor of lister. Suggesters return a list
 * with dumbed down value, label pairs. This is used for things
 * like autocomplete using AJAX. It it use the value of ctx.key
 * for values and labels if onSuggestTupple is not provided.
 */
module.exports = ( ctx = {} ) => {

  const {
    key = 'id',
    fnName = 'suggest',
    onSuggestTuple,
    suggestValueKey = null,
    suggestLabelKey = null,
    logger,
  } = ctx;

  const keys = _makeKeys(key);

  const _defaultSuggestTuple = (record) => {

    const stringKeys = objValueAggregateString(record, keys);

    const suggestValue = isNull(suggestValueKey)
      ? stringKeys
      : getIfSet(record, suggestValueKey);

    const suggestLabel = isNull(suggestLabelKey)
      ? stringKeys
      : getIfSet(record, suggestLabelKey);

    return {
      value: suggestValue,
      label: suggestLabel,
    }

  };

  const useCustomMap = isFunction(onSuggestTuple);

  /*
   * I debated whether or not to use suggest as a type of lister
   * but concluded there is very likely a need to do joins for
   * suggested results and even offer pagination/ordering.
   * This shall remain a lister unless there is dire need.
   */
  return lister({
    ...ctx,
    fnName,
    onListResult: (listResult) => {
      return {
        ...listResult,
        result: (
          useCustomMap
            ? listResult.result.map(onSuggestTuple)
            : listResult.result.map(_defaultSuggestTuple)
        ),
      };
    }
  });

};

