const crypto = require('crypto');

// helper functions that proxy crypto and use
// sensible defaults and are very succinct
const randStr = (b = 16, enc = 'hex') => crypto.randomBytes(b).toString(enc);

const randInt = (min = 0, max = 10000) => crypto.randomInt(min, max);

// fake, random email. do not use if an email is sent as it
// could flag as a bounced email.
const randEmail = (domain = 'example.com') => `${randStr()}@${domain}`;

const randElem = (arr = []) => arr[Math.floor(Math.random() * arr.length)];

module.exports = {
  randElem,
  randStr,
  randInt,
  randEmail,
}
