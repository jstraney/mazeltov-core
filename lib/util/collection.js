const {
  curry,
  negateFunc,
} = require('./func');

const {
  isArray,
  isNotArray,
  isNotNull,
  isNotObject,
  isObject,
} = require('./type');

// peaks at front of array by default, but can
// peak at any index including -1.
const peak = (arr = [], index = 0) => {
  if (!isArray(arr)) {
    throw new Error('array expected for peak');
  }
  return index >= 0
    ? arr.slice(index, index + 1).shift()
    : arr.slice(index).shift();
}

// create a lookup map of distinct values which will allow
// O(1) lookup time (as opposed to array includes method).
const lookupMap = (arr = []) => arr.reduce((o, x) => ({...o, [x]: true}), {});

/*
 * same as above, but allows an array of objects. so for example
 * arr = [{name: 'bar'}, {name: 'baz'}, {name: 'foo'}]
 * with lookupObjectsMap (arr, 'name') becomes
 * {bar: {name: 'bar'}, baz: {name: 'baz'}, ...}
 * will drop
 * KNOWN LIMITATIONS:
 * - your lookup should be unique like the PK of a fetched record!
 * - non objects get ignored
 * - shallow copies!
 */
const lookupObjectsMap = (arr = [], key) => {
  return arr.reduce((o, x) => {
    return typeof x === 'object' && x !== null && x.hasOwnProperty(key)
      ? {...o, [x[key]]: { ...x }}
      : o;
  }, {});
};


/*
 * like above, but instead of a lookup that resolves an
 * object key to the object itself, it creates a lookup
 * to the objects property.
 * KNOWN LIMITATIONS:
 * - your lookup should be unique like the PK of a fetched record!
 * - non objects get ignored
 * - if the prop being looked up is undefined that is what you'll see!
 */
const objectsPropLookup = (arr = [], key, prop) => {
  return arr.reduce((o, x) => {
    return typeof x === 'object' && x !== null
      ? {...o, [x[key]]: x[prop] }
      : o;
  }, {});
};


/**
 * Iterates through array of objects and collects distinct
 * properties as a bool. This is kind of like a DISTINCT lookup
 * map for a property.
 *
 * e.g. objectsPropBoolLookup([ {name: 'yee'}, {name: 'bar'}, {name: 'bar'} ])
 * becomes:
 * { yee: true, bar: true }
 */
const objectsPropBoolLookup = (arr = [], key) => {
  return arr.reduce((o, x) => {
    return typeof x === 'object' && x !== null && x[key] !== undefined
      ? {...o, [x[key]]: true }
      : o;
  }, {});
};

/*
 * Returns a new object with all keyes specified from
 * former object. Supports a default object to allow fallback values.
 */
const subObject = (fst = {}, keys = [], def = {}) => keys.reduce((obj, key) => {

  if (fst.hasOwnProperty(key)) {
    return {...obj, [key]: fst[key] };
  } else if (def.hasOwnProperty(key)) {
    return {...obj, [key]: def[key] };
  }
  return obj;

}, {});

const numKeys    = (obj = {}) => Object.keys(obj).length;
const hasXKeys   = (obj = {}, x) => numKeys(obj) >= x;
const hasAnyKeys = (obj = {}) => numKeys(obj) > 0;
const hasNoKeys  = (obj = {}) => !hasAnyKeys(obj);
const hasKey     = (obj = {}, key) => obj.hasOwnProperty(key);

const hasKeys = (obj = {}, keys = []) => {
  return hasAnyKeys(obj) && keys.reduce((b, key) => {
    return b && hasKey(obj, key);
  }, true);
}

// Loose check on objects. useful where it is most
// important to match string an numerical values but not
// be concerned with falsey-ness.
const compareObjectsLoose = (values = {}, ...objs) => {
  for (const obj of objs) {
    if (isNotObject(obj)) {
      return false;
    }
    for (const key in values) {
      if (obj[key] != values[key]) {
        return false;
      }
    }
  }
  return true;
}

// all objects have the same key-value pairs
const compareObjects = (values = {}, ...objs) => {
  for (const obj of objs) {
    if (isNotObject(obj)) {
      return false;
    }
    for (const key in values) {
      if (obj[key] !== values[key]) {
        return false;
      }
    }
  }
  return true;
}

const elemsEqual = (index = 0, ...arrays) => {
  if (arrays.filter(isNotArray).length) {
    return false;
  }
  for (let i = 0; i < arrays.length - 1; i++) {
    if (arrays[i][index] != arrays[i + 1][index]) {
      return false;
    }
  }
  return true;
}

const elemsNotEqual = (index = 0, ...arrays) => !elemsEqual(index, ...arrays);

const maxArrayLength = (...arrays) => {
  return arrays
    .map((arr) => isArray(arr) ? arr.length : null)
    .filter((maybeNull) => isNotNull(maybeNull))
    .reduce((a, b) => Math.max(a, b), 0);
}

const minArrayLength = (...arrays) => {
  return arrays
    .map((arr) => isArray(arr) ? arr.length : null)
    .filter((maybeNull) => isNotNull(maybeNull))
    .reduce((a, b) => Math.min(a, b), Number.MAX_SAFE_INTEGER);
}

/**
 * Thanks!: https://stackoverflow.com/a/48218209/10343551
 * Performs a deep merge of objects and returns new object. Does not modify
 * objects (immutable) and merges arrays via concatenation.
 *
 * @param {...object} objects - Objects to merge
 * @returns {object} New object with merged key/values
 */
const mergeDeep = (...objects) => {
  const isObject = obj => obj && typeof obj === 'object';

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      }
      else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      }
      else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
};

const compareSlices = (arrays, from = 0, to = null) => {
  const end = to === null ? maxArrayLength(...arrays): to;
  for (let i = from; i <= end; i++) {
    if (elemsNotEqual(i, ...arrays)) {
      return false;
    }
  }
  return true;
}

const hasElems   = (arr = []) => isArray(arr) ? arr.length > 0 : false;
const hasNoElems = (arr = []) => !hasElems(arr);
const numElems   = (arr = []) => arr.length
const hasXElems  = (arr = [], x = 1) => numElems(arr) >= x;

const getIfSet = (obj, key, def) => hasKey(obj, key) ? obj[key] : def;

const forKeyInObj = (obj, cb) => {

  return new Promise(async (resolve, reject) => {

    for (const key in obj) {

      const val = getIfSet(obj, key);

      try {

        await cb(key, val, obj)

        resolve(true);

      } catch (error) {

        reject(true);

      }

    }

  });

};

/*
 * Aggregate object values, in order, into an array.
 */
const objValueAggregateArray = (obj, keys) => {
  return keys.reduce((arr, key, index) => {
    return arr.concat(getIfSet(obj, key, null));
  }, []);
};


/*
 * Similar to the subObject helper, but returns a
 * string aggregated result. example:
 * stringAggregateKeys({baz: 'lol', bar: 12}, ['bar', 'baz']);
 * becomes:
 * 'lol:12'
 * - Order is determined by keys on the second array.
 * - You can change the glue by passing '-', or '_' to third param.
 * - Missing keys will return empty string!
 */
const objValueAggregateString = (obj, keys, glue=':') => {
  return keys.reduce((str, key, index) => {
    if (index === 0) {
      return str.concat(getIfSet(obj, key, ''))
    } else if (hasKey(obj, key)) {
      return str.concat(glue, obj[key]);
    }
    return str;
  }, '');
};

const arraysMaxLength = (...arrays) => {
  arrays.reduce((max, arr) => {
    return isArray(arr) && arr.length > max
      ? arr.length
      : max;
  }, 0);
}

const arraysMinLength = (...arrays) => {
  const oo = Number.MAX_SAFE_INTEGER;
  arrays.reduce((min, arr) => {
    return isArray(arr) && arr.length < min
      ? arr.length
      : min;
  }, oo);
}

const buildArray = (n, cb) => Array.from(Array(+n), (_, i) => cb(i));

const uniqueArray = (array) => [...new Set(array)];

/*
 * Thanks man! Get cartesian product of arrays
 * https://bit.ly/3dRHxSU
 */
const cartesian = (...arrays) => {

  const sets = arrays
    .filter(isArray)
    .map(uniqueArray);

  return sets.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

};

const arrayIncludes = (array = [], ...args) => {
  const lookup = lookupMap(array);
  return args.reduce((bool, elem, i) => {
    return i > 0
      ? !!(bool && lookup[elem])
      : !!(lookup[elem])
  }, null);
};

const arrayNotIncluding = negateFunc(arrayIncludes);

// returns unique values in first array that
// are not in any of the following in order they
// appear in first array
const arrayDiff = (...arrs) => {
  const diff = new Map();
  const inter = new Map();
  arrs.forEach((arr, i) => {
    if (i > 0 && diff.size === 0) {
      return;
    }
    arr.forEach((elem) => {
      if (i === 0) {
        diff.set(elem, true);
        return;
      }
      if (inter.has(elem)) {
        return;
      }
      if (diff.has(elem)) {
        inter.set(elem, true);
        diff.delete(elem);
        return;
      }
    });
  }, []);
  return Array.from(diff.keys());
};

// returns unique elements from first array
// that are in following arrays in order that
// they appear in first array.
// NOTE: undefined will be removed from resulting array.
const arrayIntersect = (...arrs) => {
  const diff = new Map();
  const inter = new Map();
  const [fst, ...rest] = arrs;

  const uniqueFst = uniqueArray(fst);

  uniqueFst.forEach((elem, i) => diff.set(elem, i));

  for (let i = 0; i < rest.length; i++) {
    const arr = rest[i];
    if (inter.size === diff.size) {
      break;
    }
    for (let j = 0; j < arr.length; j++) {
      const elem = arr[j];
      if (inter.has(elem)) {
        continue;
      }
      if (diff.has(elem)) {
        const index = diff.get(elem);
        inter.set(elem, index);
        diff.delete(elem);
      }
    }
  }

  const result = [];
  for (const [value, index] of inter.entries()) {
    result[index] = value;
  }
  return result.filter((x) => x === null || x);
};

const curriedIncludes = (array = []) => {
  const lookup = lookupMap(array);
  return (...args) => {
    return args.reduce((bool, elem, i) => {
      return i > 0
        ? !!(bool && lookup[elem])
        : !!lookup[elem];
    }, null);
  };
};

// takes an array of arrays and returns n arrays
// for each positional index
const unzip = (arr = []) => {

  const nextArr = arr.filter(isArray)

  if (hasNoElems(nextArr)) {
    return [];
  }

  return arr.reduce((unzipped, arrayElement) => {
    arrayElement.forEach((elem, i) => {
      if (unzipped[i] === undefined) {
        unzipped[i] = [];
      }
      unzipped[i].push(elem);
    });
    return unzipped;
  }, []);

};

const zip = (arr = []) => {
};

const objectValueSorter = (key, desc = false) => (a, b) => {
  const
  aNotObject = isNotObject(a),
  bNotObject = isNotObject(b);
  if (aNotObject && bNotObject) return 0;
  else if (aNotObject) return desc ? 1 : -1;
  else if (bNotObject) return desc ? -1:  1;
  else if (a[key] < b[key]) return desc ? 1 : -1;
  else if (a[key] > b[key]) return desc ? -1:  1;
  return 0;
};

module.exports = {
  arrayIncludes,
  arrayDiff,
  arrayIntersect,
  arraysMaxLength,
  arraysMinLength,
  arrayNotIncluding,
  buildArray,
  cartesian,
  compareSlices,
  compareObjects,
  compareObjectsLoose,
  cross: cartesian,
  curriedIncludes,
  elemsEqual,
  elemsNotEqual,
  forKeyInObj,
  getIfSet,
  hasAnyKeys,
  hasElems,
  hasKey,
  hasKeys,
  hasNoElems,
  hasNoKeys,
  hasXElems,
  hasXKeys,
  lookupMap,
  lookupObjectsMap,
  maxArrayLength,
  minArrayLength,
  mergeDeep,
  numElems,
  numKeys,
  objValueAggregateArray,
  objValueAggregateString,
  objectsPropBoolLookup,
  objectsPropLookup,
  objectValueSorter,
  peak,
  subObject,
  uniqueArray,
  unzip,
};
