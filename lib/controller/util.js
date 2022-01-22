/*
 * The stack allows for more flexible manipulation of
 * middleware beyond pushing or shifting but uses a map
 * to allow slicing in new middleware where it is required.
 * e.g.
 * const stack = new Stack();
 * stack.set('useArgs', useArgs({
 *   ...middleware settings
 * });
 * // then from onRedux call
 * stack.after('useArgs', 'validateArgs', validateArgs({
 *   ...validation settings here
 * });
 * using set will append to the end or replace an existing
 * middleware by same key (but does not guarantee placement at end)
 *
 * front and end guarantee placing middleware by that key at the front
 * and end so use with caution.
 *
 * right now this is just used in hooks and the 'middleware' method
 * is called to return a regular stack as you'd expect to be passed
 * to express.
 */
class Stack {
  constructor(entries = []) {
    this.map = new Map(entries);
  }
  set(key, val) {
    this.map.set(key, val);
  }
  get(key, val) {
    this.map.set(key, val);
  }
  front(key, val) {
    const entries = [...this.map.entries()]
    this.map = new Map([[key, val]].concat(entries));
  }
  end(key, val) {
    const entries = [...this.map.entries()]
    this.map = new Map(entries.concat([[key, val]]));
  }
  after(match, key, val) {
    const entries = [...this.map.entries()];
    const i = entries.findIndex(([k]) => k === match);
    const fst = entries.slice(0, i + 1);
    const snd = entries.slice(i + 1);
    this.map = new Map(fst.concat([[key, val]], snd));
  }
  before(match, key, val) {
    const entries = [...this.map.entries()];
    const i = entries.findIndex(([k]) => k === match);
    const fst = entries.slice(0, i);
    const snd = entries.slice(i);
    this.map = new Map(fst.concat([[key, val]], snd));
  }
  middleware() {
    return [...this.map.values()];
  }
  middlewareNames() {
    return [...this.map.keys()];
  }
  /**
   * If very direct manipulation is needed you can fetch
   * the entries and set them yourself.
   */
  getEntries() {
    return this.map.entries();
  }
  setEntries(entries) {
    this.map = new Map(entries);
  }
}

module.exports = {
  Stack
};
