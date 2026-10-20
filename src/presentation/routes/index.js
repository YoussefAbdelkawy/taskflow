// Maps URLs to controller methods. Every feature adds its routes here.
const express = require('express');

/**
 * @param {object} controllers - the controllers built in src/container.js
 * @returns {express.Router}
 */
function createRoutes(controllers) {
  const router = express.Router();

  router.get('/health', controllers.health.getStatus);

  // Add your feature's routes below, one block per feature. Example:
  // router.post('/tasks', controllers.task.create);
  // router.get('/tasks/:id', controllers.task.getById);

  return router;
}

module.exports = { createRoutes };
