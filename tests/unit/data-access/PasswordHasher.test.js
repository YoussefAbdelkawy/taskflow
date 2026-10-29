const PasswordHasher = require('../../../src/data-access/security/PasswordHasher');

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('verifies the correct password', () => {
    expect(hasher.verify('secret123', hasher.hash('secret123'))).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(hasher.verify('wrong', hasher.hash('secret123'))).toBe(false);
  });

  it('gives different strings when hashing the same password twice (random salt)', () => {
    const first = hasher.hash('secret123');
    const second = hasher.hash('secret123');

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('rejects a stored value that is not "<salt>:<hash>"', () => {
    expect(hasher.verify('secret123', 'not-a-hash')).toBe(false);
  });
});
