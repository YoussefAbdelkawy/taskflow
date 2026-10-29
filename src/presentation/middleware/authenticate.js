// Protects routes: reads "Authorization: Bearer <token>" and sets req.user = { id, name, email }.
// A missing or invalid token throws UnauthorizedError, which errorHandler turns into 401.
const BEARER = /^Bearer (.+)$/;

const tokenFrom = (req) => BEARER.exec(req.get('Authorization') ?? '')?.[1];

/**
 * @param {import('../../business/services/AuthService')} authService
 * @returns {Function} Express middleware
 */
function createAuthenticate(authService) {
  return (req, _res, next) => {
    req.user = authService.getUserByToken(tokenFrom(req));
    next();
  };
}

module.exports = { createAuthenticate, tokenFrom };
