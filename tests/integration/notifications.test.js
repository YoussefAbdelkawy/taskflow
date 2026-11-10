const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const PASSWORD = 'Password123!';
const NOW = new Date('2026-11-10T12:00:00.000Z');

describe('FR3 notifications', () => {
  let container;
  let app;
  let users;
  let project;
  let tokens;

  beforeEach(async () => {
    container = createContainer({ databasePath: ':memory:' });
    app = createApp(container);
    const passwordHash = container.passwordHasher.hash(PASSWORD);
    users = Object.fromEntries(
      ['Mona', 'Karim', 'Omar'].map((name) => [
        name,
        container.repositories.user.create({
          name,
          email: `${name.toLowerCase()}@taskflow.test`,
          passwordHash,
        }),
      ]),
    );
    project = container.repositories.project.create({
      name: 'Website',
      description: '',
      startDate: '2026-11-01',
    });
    for (const name of Object.keys(users)) {
      container.repositories.project.addMember({
        projectId: project.id,
        userId: users[name].id,
        role: name === 'Mona' ? 'MANAGER' : 'MEMBER',
      });
    }
    tokens = {};
    for (const name of Object.keys(users)) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: `${name.toLowerCase()}@taskflow.test`, password: PASSWORD });
      tokens[name] = `Bearer ${response.body.token}`;
    }
  });

  const asUser = (name, method, path) =>
    request(app)[method](path).set('Authorization', tokens[name]);

  const saveTask = (fields = {}) =>
    container.repositories.task.create({
      projectId: project.id,
      assigneeId: users.Karim.id,
      title: 'Design the home page',
      description: '',
      status: 'TO_DO',
      priority: 'HIGH',
      dueDate: '2026-11-10',
      ...fields,
    });

  it('US3-1: assigning a task notifies the assignee with title, project, due date and priority within 5 seconds', async () => {
    const started = performance.now();
    const created = await asUser('Mona', 'post', `/api/projects/${project.id}/tasks`).send({
      title: 'Design the home page',
      assigneeId: users.Karim.id,
      dueDate: '2026-11-11',
      priority: 'HIGH',
    });
    const response = await asUser('Karim', 'get', '/api/notifications');

    expect(created.status).toBe(201);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      userId: users.Karim.id,
      taskId: created.body.id,
      type: 'ASSIGNED',
      isRead: false,
    });
    expect(response.body[0].message).toContain('Design the home page');
    expect(response.body[0].message).toContain('Website');
    expect(response.body[0].message).toContain('2026-11-11');
    expect(response.body[0].message).toContain('HIGH');
    expect(performance.now() - started).toBeLessThan(5000);
    expect((await asUser('Omar', 'get', '/api/notifications')).body).toEqual([]);
  });

  it('US3-2: two deadline checks create exactly one due-soon reminder per task', async () => {
    saveTask();
    saveTask({ title: 'Tomorrow', dueDate: '2026-11-11' });

    container.services.notification.sendReminders(NOW);
    container.services.notification.sendReminders(NOW);

    const response = await asUser('Karim', 'get', '/api/notifications');
    expect(response.body.filter(({ type }) => type === 'DUE_SOON')).toHaveLength(2);
  });

  it('US3-3: an overdue task alerts assignee and manager; a Done task gets nothing', async () => {
    const overdue = saveTask({ dueDate: '2026-11-08' });
    saveTask({ title: 'Finished', dueDate: '2026-11-08', status: 'DONE' });

    container.services.notification.sendReminders(NOW);
    container.repositories.task.update(overdue.id, { status: 'DONE' });
    container.services.notification.sendReminders(NOW);

    for (const name of ['Karim', 'Mona']) {
      const response = await asUser(name, 'get', '/api/notifications');
      expect(response.body.filter(({ type }) => type === 'OVERDUE')).toHaveLength(1);
      expect(response.body[0].taskId).toBe(overdue.id);
    }
    expect((await asUser('Omar', 'get', '/api/notifications')).body).toEqual([]);
  });

  it('only the owner can mark a notification as read, then unread count is zero', async () => {
    saveTask();
    container.services.notification.sendReminders(NOW);
    const mine = await asUser('Karim', 'get', '/api/notifications');
    const notificationId = mine.body[0].id;

    const forbidden = await asUser('Omar', 'patch', `/api/notifications/${notificationId}/read`);
    expect(forbidden.status).toBe(403);
    expect((await asUser('Karim', 'get', '/api/notifications/unread-count')).body).toEqual({
      count: 1,
    });

    const read = await asUser('Karim', 'patch', `/api/notifications/${notificationId}/read`);
    expect(read.status).toBe(200);
    expect(read.body.isRead).toBe(true);
    expect((await asUser('Karim', 'get', '/api/notifications/unread-count')).body).toEqual({
      count: 0,
    });
  });

  it('serves the notifications page with the shared header and read action', async () => {
    const response = await request(app).get('/notifications.html');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<header id="app-header"></header>');
    expect(response.text).toContain('Mark as read');
    expect(response.text).toContain('js/layout.js');
  });

  it('NFR Performance: 95% of 200 concurrent users get unread counts within 2 seconds', async () => {
    const server = app.listen(0);
    try {
      const requests = Array.from({ length: 200 }, (_, index) => {
        const user = container.repositories.user.create({
          name: `User ${index}`,
          email: `user${index}@taskflow.test`,
          passwordHash: 'x:y',
        });
        const token = container.repositories.session.create(user.id);
        const started = performance.now();
        return request(server)
          .get('/api/notifications/unread-count')
          .set('Authorization', `Bearer ${token}`)
          .then((response) => ({ status: response.status, elapsed: performance.now() - started }));
      });
      const results = await Promise.all(requests);
      const durations = results.map(({ elapsed }) => elapsed).sort((left, right) => left - right);

      expect(results.every(({ status }) => status === 200)).toBe(true);
      expect(durations[189]).toBeLessThan(2000);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
