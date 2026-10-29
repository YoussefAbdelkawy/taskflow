const { ValidationError, UnauthorizedError } = require('../errors/AppError');

const WRONG_LOGIN = 'Wrong email or password';
const PLEASE_LOG_IN = 'Please log in';

// Only these fields ever leave the service: never the passwordHash.
const toPublicUser = ({ id, name, email }) => ({ id, name, email });

/** Logs users in and out, and finds the logged-in user from a token. */
class AuthService {
  constructor({ userRepository, sessionRepository, passwordHasher }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.passwordHasher = passwordHasher;
  }

  /**
   * @param {{ email: string, password: string }} credentials
   * @returns {{ token: string, user: { id: number, name: string, email: string } }}
   * requires: email and password are non-empty strings
   * effects: starts a session and returns its token; throws ValidationError if a field is
   *          missing, UnauthorizedError (same message) for an unknown email or wrong password
   * modifies: the session store
   */
  login({ email, password } = {}) {
    // Imperative: guard clauses, step by step
    if (!email || !password) throw new ValidationError('Email and password are required');

    const user = this.userRepository.findByEmail(email);
    if (!user) throw new UnauthorizedError(WRONG_LOGIN);
    if (!this.passwordHasher.verify(password, user.passwordHash)) {
      throw new UnauthorizedError(WRONG_LOGIN);
    }

    return { token: this.sessionRepository.create(user.id), user: toPublicUser(user) };
  }

  /**
   * @param {string} token
   * effects: the token no longer works (nothing happens if it was unknown)
   * modifies: the session store
   */
  logout(token) {
    this.sessionRepository.delete(token);
  }

  /**
   * @param {string | undefined} token
   * @returns {{ id: number, name: string, email: string }}
   * effects: returns the logged-in user; throws UnauthorizedError('Please log in') if the
   *          token is missing, unknown, or its user no longer exists
   * modifies: nothing
   */
  getUserByToken(token) {
    if (!token) throw new UnauthorizedError(PLEASE_LOG_IN);

    const userId = this.sessionRepository.findUserId(token);
    const user = userId === null ? null : this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedError(PLEASE_LOG_IN);

    return toPublicUser(user);
  }
}

module.exports = AuthService;
