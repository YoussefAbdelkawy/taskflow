// Hashes passwords with scrypt (built into node:crypto) and a random salt per password.
// Lives in data-access so the seed script can use it too; services receive it in the constructor.
const crypto = require('node:crypto');

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SEPARATOR = ':';

class PasswordHasher {
  /**
   * @param {string} password
   * @returns {string} "<saltHex>:<hashHex>"
   */
  hash(password) {
    const salt = crypto.randomBytes(SALT_BYTES);
    const hash = crypto.scryptSync(password, salt, KEY_LENGTH);
    return `${salt.toString('hex')}${SEPARATOR}${hash.toString('hex')}`;
  }

  /**
   * @param {string} password
   * @param {string} stored - a value made by hash()
   * @returns {boolean} true if the password matches
   */
  verify(password, stored) {
    const [saltHex, hashHex] = String(stored).split(SEPARATOR);
    if (!saltHex || !hashHex) return false;

    const expected = Buffer.from(hashHex, 'hex');
    if (expected.length !== KEY_LENGTH) return false;

    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
    return crypto.timingSafeEqual(actual, expected);
  }
}

module.exports = PasswordHasher;
