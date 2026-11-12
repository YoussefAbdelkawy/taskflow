// Builds the Express app (without starting it), so tests can use it directly.
const path = require('node:path');
const express = require('express');
const { createRoutes } = require('./presentation/routes');
const { errorHandler } = require('./presentation/middleware/errorHandler');
const openApiSpec = require('./presentation/docs/openapi');

const PUBLIC_FOLDER = path.join(__dirname, '..', 'public');
const SWAGGER_PAGE = path.join(__dirname, 'presentation', 'docs', 'swagger.html');
const SWAGGER_UI_FILES = path.dirname(require.resolve('swagger-ui-dist/package.json'));

function createApp(container) {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_FOLDER)); // the frontend (HTML/CSS/JS)

  // Swagger UI for the API demo: http://localhost:3000/api-docs
  app.get('/api-docs', (_req, res) => res.sendFile(SWAGGER_PAGE));
  app.get('/api-docs/openapi.json', (_req, res) => res.json(openApiSpec));
  app.use('/api-docs', express.static(SWAGGER_UI_FILES, { index: false }));

  const { controllers, middleware } = container;
  app.use('/api', createRoutes({ controllers, authenticate: middleware.authenticate })); // the backend API
  app.use(errorHandler); // must be last
  return app;
}

module.exports = { createApp };
