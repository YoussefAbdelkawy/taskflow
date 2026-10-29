// The frontend base pages are served and load their scripts in the right order.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

describe('frontend base pages', () => {
  const app = createApp(createContainer({ databasePath: ':memory:' }));

  it('index.html has the shared header, the status line, a welcome line and the scripts in order', async () => {
    const { status, text } = await request(app).get('/index.html');

    expect(status).toBe(200);
    expect(text).toContain('<header id="app-header"></header>');
    expect(text).toContain('id="status"');
    expect(text).toContain('id="welcome"');
    const order = ['js/api.js', 'js/layout.js', 'js/app.js'].map((src) => text.indexOf(src));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('login.html has an email and password form and loads api.js then login.js', async () => {
    const { status, text } = await request(app).get('/login.html');

    expect(status).toBe(200);
    expect(text).toContain('type="email"');
    expect(text).toContain('type="password"');
    expect(text.indexOf('js/api.js')).toBeLessThan(text.indexOf('js/login.js'));
  });

  it.each(['/js/layout.js', '/js/login.js'])('serves %s', async (url) => {
    expect((await request(app).get(url)).status).toBe(200);
  });
});
