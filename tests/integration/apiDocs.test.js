// The Swagger page (/api-docs) and its OpenAPI spec stay in step with the real routes.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');
const { createRoutes } = require('../../src/presentation/routes');
const openApiSpec = require('../../src/presentation/docs/openapi');

// Every route the router really has, as "get /tasks/{id}" (OpenAPI path style).
const realRoutes = () => {
  const anyHandler = () => () => {};
  const controllers = new Proxy({}, { get: () => new Proxy({}, { get: anyHandler }) });
  const router = createRoutes({ controllers, authenticate: anyHandler() });
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map(
        (method) => `${method} ${layer.route.path.replace(/:(\w+)/g, '{$1}')}`,
      ),
    );
};

const documentedRoutes = () =>
  Object.entries(openApiSpec.paths).flatMap(([path, operations]) =>
    Object.keys(operations).map((method) => `${method} ${path.replace(/^\/api/, '')}`),
  );

describe('API documentation (Swagger)', () => {
  const app = createApp(createContainer({ databasePath: ':memory:' }));

  it('documents every route in routes/index.js, and nothing that does not exist', () => {
    expect([...documentedRoutes()].sort()).toEqual([...realRoutes()].sort());
  });

  it('serves the OpenAPI spec as JSON', async () => {
    const { status, body } = await request(app).get('/api-docs/openapi.json');

    expect(status).toBe(200);
    expect(body.openapi).toMatch(/^3\./);
    expect(body.paths['/api/auth/login'].post).toBeDefined();
  });

  it('serves the Swagger UI page from local files (no internet needed during the demo)', async () => {
    const page = await request(app).get('/api-docs');
    const bundle = await request(app).get('/api-docs/swagger-ui-bundle.js');

    expect(page.status).toBe(200);
    expect(page.text).toContain('swagger-ui-bundle.js');
    expect(page.text).toContain('openapi.json');
    expect(page.text).not.toMatch(/https?:\/\//);
    expect(bundle.status).toBe(200);
  });
});
