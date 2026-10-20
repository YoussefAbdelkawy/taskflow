// Integration test: runs the real app (all layers) against a throwaway in-memory database.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

describe('GET /api/health', () => {
  const app = createApp(createContainer({ databasePath: ':memory:' }));

  it('responds with status ok', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('serves the frontend page', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('TaskFlow');
  });
});
