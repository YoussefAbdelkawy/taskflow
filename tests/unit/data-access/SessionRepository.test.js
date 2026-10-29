const SessionRepository = require('../../../src/data-access/repositories/SessionRepository');

describe('SessionRepository', () => {
  it('creates a token for a user and finds the user by it', () => {
    const sessions = new SessionRepository();

    const token = sessions.create(7);

    expect(typeof token).toBe('string');
    expect(sessions.findUserId(token)).toBe(7);
  });

  it('returns null for an unknown or deleted token', () => {
    const sessions = new SessionRepository();
    const token = sessions.create(7);

    sessions.delete(token);

    expect(sessions.findUserId(token)).toBeNull();
    expect(sessions.findUserId('unknown')).toBeNull();
  });
});
