const buffer = require('buffer');
const crypto = require('crypto');
const pbkdf2 = require('pbkdf2');

const cipher = ( config = {} ) => {

  const {
    algo = 'aes-256-gcm',
    logErrors = true,
    logger = global.console,
    skeletonKey,
    throwErrors = false,
  } = config;

  const encrypt = (text, skeletonKey) => {

    try {

      // random initialization vector
      const iv = crypto.randomBytes(16);

      // random salt
      const salt = crypto.randomBytes(64);

      // derive encryption key: 32 byte key length
      // in assumption the skeletonkey is a cryptographic and NOT a password there is no need for
      // a large number of iterations. It may can replaced by HKDF
      // the value of 2145 is randomly chosen!
      const key = pbkdf2.pbkdf2Sync(skeletonKey, salt, 10000, 32, 'sha512');

      // AES 256 GCM Mode
      const cipher = crypto.createCipheriv(algo, key, iv);

      // encrypt the given text
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

      // extract the auth tag
      const tag = cipher.getAuthTag();

      // generate output
      return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');

    } catch (error) {

      logErrors && logger.error('%o', error);

      if (throwErrors) {
        throw error;
      }

    }

    return null;

  }

  const decrypt = (encdata, skeletonKey) => {

    // base64 decoding
    try {

      const bData = Buffer.from(encdata, 'base64');

      // convert data to buffers
      const salt = bData.slice(0, 64);
      const iv = bData.slice(64, 80);
      const tag = bData.slice(80, 96);
      const text = bData.slice(96);

      // derive key using; 32 byte key length
      const key = pbkdf2.pbkdf2Sync(skeletonKey, salt, 10000, 32, 'sha512');

      // AES 256 GCM Mode
      const decipher = crypto.createDecipheriv(algo, key, iv);
      decipher.setAuthTag(tag);

      // encrypt the given text
      return decipher.update(text, 'binary', 'utf8') + decipher.final('utf8');

    } catch (error) {

      logErrors && logger.error('%o', error);

      if (throwErrors) {
        throw error;
      }

    }

    return null;

  }

  return {
    encrypt,
    decrypt,
  }

}

module.exports = {
  cipher,
};
