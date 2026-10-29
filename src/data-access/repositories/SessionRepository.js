// Login sessions: token -> userId.
// Kept in memory only, so every session resets when the server restarts.
// That is acceptable for the beta: users just log in again.
const crypto = require('node:crypto');

class SessionRepository {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * @param {number} userId
   * @returns {string} a new random token
   * modifies: the session store
   */
  create(userId) {
    const token = crypto.randomUUID();
    this.sessions.set(token, userId);
    return token;
  }

  /**
   * @param {string} token
   * @returns {number | null} the user id, or null if the token is unknown
   */
  findUserId(token) {
    return this.sessions.get(token) ?? null;
  }

  /**
   * @param {string} token
   * @returns {boolean} true if the session existed
   * modifies: the session store
   */
  delete(token) {
    return this.sessions.delete(token);
  }
}

module.exports = SessionRepository;
