
const tern = (a, b, ifTrue = true, ifFalse = false) => {
  return a === b
    ? ifTrue
    : ifFalse;
}

const and = (...args) => args.reduce((b, x) => b && x, true);

const andArr = (arr) => and(...arr);

const or = (...args) => args.reduce((b, x) => b || x, false);

const orArr = (arr) => or(...arr);

/*
 * Deferred logic. accepts array or param list of thenables
 * which will perform or/and on them
 */
const andQ    = async (...args) => Promise.all(args).then(andArr).catch(() => false);
const andArrQ = async (args) => andQ(...args);
const orQ     = async (...args)  => Promise.all(args).then(orArr).catch(() => false);
const orArrQ  = async (args)  => orQ(...args);

module.exports = {
  and,
  or,
  andArr,
  orArr,
  tern,
  andQ,
  andArrQ,
  orQ,
  orArrQ,
};
