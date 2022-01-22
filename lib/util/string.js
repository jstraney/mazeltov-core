const {
  countryCodeLookup,
} = require('./data');

const {
  getIfSet,
} = require('./collection');

const {
  isNotNumber,
  isNull,
  isNumber,
  isRegexp,
  isString,
  isNotString,
} = require('./type')

const {
  orArr,
} = require('./logic');

const changeCase = require('change-case');

const pluralize = require('pluralize');

const objFromQuery = (str) => {
  return str.split('&')
    .map((part) => part.split('='))
    .reduce((obj, [k, v]) => {
      if (!k) {
        return obj;
      }
      return {
        ...obj,
        [k]: v,
      };
    });
}

/*
 * left pad a string with an optionally repeated string
 * lpad('foo', '+') === '+foo';
 * lpad('foo', '+', 6) === '++++++foo';
 */
const lpad = (str = '', padding = ' ', times = 1) => {
  return padding.repeat(times).concat(str);
};

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/*
 * right pad a string with an optionally repeated string
 * rpad('foo', '+') === 'foo+';
 * rpad('foo', '+', 6) === 'foo++++++';
 */
const rpad = (str = '', padding = ' ', times = 1) => {
  return str.concat(padding.repeat(times));
};

/*
 * pad a string on both ends with an optionally repeated string
 * pad('foo', '+') === '+foo+';
 * pad('foo', '+', 3) === '+++foo+++';
 */
const pad = (str = '', padding = ' ', times = 1) => {
  return rpad(lpad(str, padding, times), padding, times);
};

/*
 * Will padd a string with characters until it is n characters long
 * akin to center alignment and good for CLI styling
 */
const autoPad = (str = '', padding = ' ', desiredWidth = 0) => {

  const
  currentWidth = str.length,
  iters = Math.max(0, Math.floor((desiredWidth - currentWidth) / 2));

  return (iters * 2) + currentWidth < desiredWidth
    ? pad(str + padding, padding, iters)
    : pad(str, padding, iters);

}

const wrap = (str = '', prefix = '', suffix = prefix) => rpad(lpad(str, prefix), suffix);

const quote = (str = '') => wrap(str, '"');

/*
 * rtrim and ltrim work similar to String.prototype.trim but only trim
 * from left or right side and allow a different pattern other than
 * whitespace to be passed (can trim leading or trailing # for example).
 * trim also allows the trim pattern to be passed and trims from both
 * ends.
 */
const rtrim = (str = '', trimming = /\s+$/g) => {
  if (isRegexp(trimming)) {
    return str.replace(trimming, '');
  } else if (isString(trimming)) {
    const escaped = escapeRegex(trimming);
    return str.replace(new RegExp(`${escaped}+$`, 'g'), '');
  }
  return str;
}

const ltrim = (str = '', trimming = /^\s+/g) => {
  if (isRegexp(trimming)) {
    return str.replace(trimming, '');
  } else if (isString(trimming)) {
    const escaped = escapeRegex(trimming);
    return str.replace(new RegExp(`^${escaped}+`, 'g'), '');
  }
  return str;
}

const trim = (str = '', trimming = null) => {
  return isNull(trimming)
    ? rtrim(ltrim(str))
    : rtrim(ltrim(str, trimming), trimming);
}

const split = (str = '', glue = ',', trimming = null) => {
  return str.split(glue).map((s) => trim(s, trimming));
};

const join = (arr = [], glue = ',') => arr.join(glue);

const list = (arr = []) => join(arr, ', ');

const joinWords = (arr = []) => join(arr, ' ');

const classList = joinWords;

// Format currency. Note that we may want to format crypto currency
// which supports many decimal places.
const fmtCurrency = (num, curr='$', places = 2) => {
  return isNumber(num)
    ? `${curr}${(+num).toFixed(places)}`
    : `${curr}${(0).toFixed(places)}`;
}

const fmtPercent = (num, p = 2, mult100 = true) => {
  return isNumber(num)
    ? `${(mult100 ? num * 100 : num).toFixed(p)}%`
    : `${(0).toFixed(p)}%`;
}

const boolFormater = (yesVal, noVal) => (val) => !!val ? yesVal : noVal;
const fmtYesNo = boolFormater('Yes', 'No');
const fmtYN = boolFormater('Y', 'N');

const fmtBytes = (numBytes, unit = 'GB', p = 2) => {
  if (isNotNumber(numBytes)) {
    numBytes = 0;
  }
  if (['TB', 'tb', 'T', 't'].includes(unit)) {
    const value = (numBytes / Math.pow(1024, 4)).toFixed(p);
    return `${value} TB`;
  } else if (['GB', 'gb', 'G', 'g'].includes(unit)) {
    const value = (numBytes / Math.pow(1024, 3)).toFixed(p);
    return `${value} GB`;
  } else if (['MB', 'mb', 'M', 'm'].includes(unit)) {
    const value = (numBytes / Math.pow(1024, 2)).toFixed(p);
    return `${value} Mb`;
  } else if (['KB', 'kb', 'K', 'k'].includes(unit)) {
    const value = (numBytes / 1024).toFixed(p);
    return `${value} kb`;
  }
  return `${numBytes} bytes`;
}


const fmtE164 = (isoCode) => {
  return countryCodeLookup[isoCode]
    ? countryCodeLookup[isoCode].dialCode
    : '';
}

const fmtPhone = (telephone, glue = '-') => {
  const [cc, area, num] = telephone.split(glue)

  return [
    isNumber(cc) ? cc : fmtE164(cc),
    area,
    num
  ].join(glue);
};

/*
 * formats a docker json Template for output. so passing
 * ['Status', 'Name'] will produce the following
 * {status: {{.Status}}: name: {{.Name}}}
 * and it will be properly escaped
 */
const fmtDockerJsonTpl = (fields) => {

  return fields.reduce((str, field, index) => {

    const camelCase = field[0].toLowerCase() + field.slice(1);

    return index == fields.length - 1
      ? str + `"${camelCase}":"{{.${field}}}"`
      : str + `"${camelCase}":"{{.${field}}}",`;

  }, "'{") + "}'";

};

const fmtTuple = (arr = []) => wrap(join(arr), '(', ')');

// expects an array of arrays
const fmtTuples = (arr = []) => join(arr.map(fmtTuple));

const handlebarExp = new RegExp('{{[a-zA-Z0-9_]+}}', 'g');

const fmtVariables = (str, vars, exp = handlebarExp) => str.replace(exp, (match) => {
  return getIfSet(vars, match.slice(2, -2), '');
});
const fmtHandlebars = fmtVariables;

const placeholderExp = new RegExp('(?::)([a-zA-Z0-9_]+)', 'g');
const fmtPlaceholder = (str, vars, drop = false) => str.replace(placeholderExp, (_, match) => {
  return getIfSet(vars, match, drop ? '' : `:${match}`);
});

/* checks if THIS (a) begins with THAT (b) */
const beginsWith = (a, b) => {
  if (orArr([a, b].map(isNotString))) {
    return false;
  }
  return a.slice(0, b.length) === b;
};

const doesNotBeginWith = (a, b) => !beginsWith(a, b);

/* does THIS (a) end with THAT (b) */
const endsWith = (a, b) => {
  if (orArr([a, b].map(isNotString))) {
    return false;
  }
  return a.slice(-b.length) === b;
};

const doesNotEndWith = (a, b) => !endsWith(a, b);

// Converting any arbitrary string to a machine readable one
// is a one-way transformation which makes the string interpolable
// to most programmatic contexts and also normalizes text in a readable way
// use case:
// We have a user facing tagging system and some people are typing
// facebook sucks
// FaceBook sucks
// Face-book-sucks!!!
// We want to preserve the original intent as best as possible while being
// able to collapse these into a normalized value for analysis.
// Most languages do not support non-ASCII characters or tokens with leading
// numbers, so this will take care of these cases such that the resulting
// token can be easily used in a programmatic context.
const machineName = (str) => {
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s-_]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^([0-9]+)/, '_$&');
};

module.exports = {
  ...changeCase,
  autoPad,
  beginsWith,
  boolFormater,
  classList,
  doesNotBeginWith,
  doesNotEndWith,
  endsWith,
  fmtBytes,
  fmtCurrency,
  fmtDockerJsonTpl,
  fmtPercent,
  fmtE164,
  fmtHandlebars,
  fmtPhone,
  fmtPlaceholder,
  fmtTuple,
  fmtTuples,
  fmtYesNo,
  fmtYN,
  fmtVariables,
  join,
  joinWords,
  list,
  lpad,
  ltrim,
  machineName,
  objFromQuery,
  pad,
  pluralize,
  quote,
  rpad,
  rtrim,
  split,
  trim,
  wrap,
};
