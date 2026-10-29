// Maps URLs to controller methods. Every feature adds its routes here.
const express = require('express');

/**
 * @param {{ controllers: object, authenticate: Function }} deps - built in src/container.js
 * @returns {express.Router}
 */
function createRoutes({ controllers, authenticate }) {
  const router = express.Router();

  // 1. Public: no login needed
  router.get('/health', controllers.health.getStatus);
  router.post('/auth/login', controllers.auth.login);

  // 2. Everything below needs a logged-in user (req.user)
  router.use(authenticate);

  // 3. Protected. Later features add their routes in this part, one block per feature.
  router.post('/auth/logout', controllers.auth.logout);
  router.get('/auth/me', controllers.auth.me);

  // FR2: recurring tasks
  router.get('/tasks/:id/recurrence', controllers.recurrence.get);
  router.put('/tasks/:id/recurrence', controllers.recurrence.set);
  router.delete('/tasks/:id/recurrence', controllers.recurrence.turnOff);

  return router;
}

module.exports = { createRoutes };
