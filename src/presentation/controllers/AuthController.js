const { tokenFrom } = require('../middleware/authenticate');

const NO_CONTENT = 204;

/** HTTP in, JSON out for logging in and out. */
class AuthController {
  constructor({ authService }) {
    this.authService = authService;
  }

  login = (req, res) => {
    res.json(this.authService.login(req.body));
  };

  logout = (req, res) => {
    this.authService.logout(tokenFrom(req));
    res.status(NO_CONTENT).end();
  };

  me = (req, res) => {
    res.json(req.user);
  };
}

module.exports = AuthController;
