// Builds the Express app (without starting it), so tests can use it directly.
const path = require('node:path');
const express = require('express');
const { createRoutes } = require('./presentation/routes');
const { errorHandler } = require('./presentation/middleware/errorHandler');

const PUBLIC_FOLDER = path.join(__dirname, '..', 'public');

function createApp(container) {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_FOLDER)); // the frontend (HTML/CSS/JS)
  app.use('/api', createRoutes(container.controllers)); // the backend API
  app.use(errorHandler); // must be last
  return app;
}

module.exports = { createApp };
