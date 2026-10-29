// Login through the real app, all layers, against an in-memory database.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

describe('login API', () => {
  let app;

  beforeEach(() => {
    const container = createContainer({ databasePath: ':memory:' });
    container.repositories.user.create({
      name: 'Sara',
      email: 'sara@taskflow.test',
      passwordHash: container.passwordHasher.hash('secret123'),
    });
    app = createApp(container);
  });

  const login = () =>
    request(app)
      .post('/api/auth/login')
      .send({ email: 'sara@taskflow.test', password: 'secret123' });

  it('POST /api/auth/login with valid details → 200 and a token', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user).toEqual({ id: 1, name: 'Sara', email: 'sara@taskflow.test' });
  });

  it('POST /api/auth/login with a wrong password → 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sara@taskflow.test', password: 'nope' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Wrong email or password' });
  });

  it('GET /api/auth/me without a token → 401', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Please log in' });
  });

  it('GET /api/auth/me with an invalid token → 401', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer made-up');

    expect(response.status).toBe(401);
  });

  it('GET /api/auth/me with the token → the user, with no passwordHash in the body', async () => {
    const { token } = (await login()).body;

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Sara', email: 'sara@taskflow.test' });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('POST /api/auth/logout → 204, and the token stops working', async () => {
    const { token } = (await login()).body;
    const auth = `Bearer ${token}`;

    const logout = await request(app).post('/api/auth/logout').set('Authorization', auth);
    const me = await request(app).get('/api/auth/me').set('Authorization', auth);

    expect(logout.status).toBe(204);
    expect(me.status).toBe(401);
  });

  it('GET /api/health still works without a token', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
