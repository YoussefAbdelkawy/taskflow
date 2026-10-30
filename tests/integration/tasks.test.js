// FR1 through the real app: HTTP API, the real services and SQLite in memory.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const PASSWORD = 'secret123';

// One project: Mona manages it, Karim and Omar are members. Hany is in no project.
function addTeam(container) {
  const { user, project } = container.repositories;
  const passwordHash = container.passwordHasher.hash(PASSWORD);
  const addUser = (name) =>
    user.create({ name, email: `${name.toLowerCase()}@taskflow.test`, passwordHash });
  const team = {
    mona: addUser('Mona'),
    karim: addUser('Karim'),
    omar: addUser('Omar'),
    hany: addUser('Hany'),
  };
  const website = project.create({ name: 'Website', description: '', startDate: '2026-10-01' });
  project.addMember({ projectId: website.id, userId: team.mona.id, role: 'MANAGER' });
  project.addMember({ projectId: website.id, userId: team.karim.id, role: 'MEMBER' });
  project.addMember({ projectId: website.id, userId: team.omar.id, role: 'MEMBER' });
  return { team, website };
}

describe('tasks API (FR1)', () => {
  let app;
  let team;
  let website;
  const auth = {};

  beforeEach(async () => {
    const container = createContainer({ databasePath: ':memory:' });
    ({ team, website } = addTeam(container));
    app = createApp(container);
    for (const name of Object.keys(team)) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: `${name}@taskflow.test`, password: PASSWORD });
      auth[name] = `Bearer ${response.body.token}`;
    }
  });

  const newTask = (overrides = {}) => ({
    title: 'Design the home page',
    description: 'Hero section and footer',
    assigneeId: team.karim.id,
    dueDate: '2026-11-02',
    priority: 'HIGH',
    ...overrides,
  });

  const createTask = (as, body = newTask()) =>
    request(app)
      .post(`/api/projects/${website.id}/tasks`)
      .set('Authorization', auth[as])
      .send(body);

  const getTask = (as, id) => request(app).get(`/api/tasks/${id}`).set('Authorization', auth[as]);

  const changeStatus = (as, id, status) =>
    request(app).patch(`/api/tasks/${id}/status`).set('Authorization', auth[as]).send({ status });

  describe('POST /api/projects/:projectId/tasks', () => {
    it('US1-1: a manager creates a task → 201, saved as TO_DO', async () => {
      const response = await createTask('mona');

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        projectId: website.id,
        assigneeId: team.karim.id,
        title: 'Design the home page',
        dueDate: '2026-11-02',
        priority: 'HIGH',
        status: 'TO_DO',
      });
    });

    it('NFR Security: a member creating a task → 403, nothing saved', async () => {
      const response = await createTask('karim');
      const list = await request(app)
        .get(`/api/projects/${website.id}/tasks`)
        .set('Authorization', auth.mona);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Only a project manager can create tasks' });
      expect(list.body).toEqual([]);
    });

    it('an assignee outside the project → 400', async () => {
      const response = await createTask('mona', newTask({ assigneeId: team.hany.id }));

      expect(response.status).toBe(400);
    });

    it('without a token → 401', async () => {
      const response = await request(app).post(`/api/projects/${website.id}/tasks`).send(newTask());

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects/:projectId/tasks', () => {
    it('a member gets the project’s tasks → 200', async () => {
      const created = (await createTask('mona')).body;

      const response = await request(app)
        .get(`/api/projects/${website.id}/tasks`)
        .set('Authorization', auth.omar);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([created]);
    });

    it('NFR Security: a non-member → 403', async () => {
      const response = await request(app)
        .get(`/api/projects/${website.id}/tasks`)
        .set('Authorization', auth.hany);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/projects/:projectId/members', () => {
    it('a member gets the possible assignees as id, name and role only (no email, no hash)', async () => {
      const response = await request(app)
        .get(`/api/projects/${website.id}/members`)
        .set('Authorization', auth.karim);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: team.mona.id, name: 'Mona', role: 'MANAGER' },
        { id: team.karim.id, name: 'Karim', role: 'MEMBER' },
        { id: team.omar.id, name: 'Omar', role: 'MEMBER' },
      ]);
    });

    it('NFR Security: a non-member → 403', async () => {
      const response = await request(app)
        .get(`/api/projects/${website.id}/members`)
        .set('Authorization', auth.hany);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/tasks/mine', () => {
    it('US1-1: returns only my tasks', async () => {
      const karims = (await createTask('mona')).body;
      await createTask('mona', newTask({ title: 'Fix the login bug', assigneeId: team.omar.id }));

      const response = await request(app).get('/api/tasks/mine').set('Authorization', auth.karim);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([karims]);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('a member gets the task → 200', async () => {
      const created = (await createTask('mona')).body;

      const response = await getTask('omar', created.id);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(created);
    });

    it('NFR Security: a non-member → 403', async () => {
      const created = (await createTask('mona')).body;

      const response = await getTask('hany', created.id);

      expect(response.status).toBe(403);
    });

    it('an unknown task → 404', async () => {
      const response = await getTask('mona', 999);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Task 999 not found' });
    });
  });

  describe('PATCH /api/tasks/:id/status', () => {
    it('US1-2: the assignee changes the status → 200, and the history shows old, new, who, when', async () => {
      const created = (await createTask('mona')).body;

      const response = await changeStatus('karim', created.id, 'IN_PROGRESS');
      const history = await request(app)
        .get(`/api/tasks/${created.id}/history`)
        .set('Authorization', auth.mona);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('IN_PROGRESS');
      expect(history.status).toBe(200);
      expect(history.body).toEqual([
        {
          id: expect.any(Number),
          taskId: created.id,
          oldStatus: 'TO_DO',
          newStatus: 'IN_PROGRESS',
          changedBy: team.karim.id,
          changedByName: 'Karim',
          changedAt: expect.any(String),
        },
      ]);
    });

    it('US1-3: a user who is neither assignee nor manager → 403, status unchanged', async () => {
      const created = (await createTask('mona')).body;

      const response = await changeStatus('omar', created.id, 'DONE');
      const after = await getTask('mona', created.id);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Only the assignee or a project manager can change the status',
      });
      expect(after.body.status).toBe('TO_DO');
    });

    it('US1-3: a user outside the project → 403, status unchanged', async () => {
      const created = (await createTask('mona')).body;

      const response = await changeStatus('hany', created.id, 'DONE');
      const after = await getTask('mona', created.id);

      expect(response.status).toBe(403);
      expect(after.body.status).toBe('TO_DO');
    });

    it('an unknown status → 400', async () => {
      const created = (await createTask('mona')).body;

      const response = await changeStatus('karim', created.id, 'IN_REVIEW');

      expect(response.status).toBe(400);
    });

    it('FR1 + FR2: completing a weekly task through the API creates next week’s copy once', async () => {
      const created = (await createTask('mona')).body;
      await request(app)
        .put(`/api/tasks/${created.id}/recurrence`)
        .set('Authorization', auth.mona)
        .send({ frequency: 'WEEKLY' });

      await changeStatus('karim', created.id, 'IN_PROGRESS');
      const done = await changeStatus('karim', created.id, 'DONE');
      const mine = await request(app).get('/api/tasks/mine').set('Authorization', auth.karim);

      expect(done.status).toBe(200);
      expect(mine.body.map(({ dueDate, status }) => [dueDate, status])).toEqual([
        ['2026-11-02', 'DONE'],
        ['2026-11-09', 'TO_DO'],
      ]);
    });
  });

  describe('GET /api/tasks/:id/history', () => {
    it('NFR Security: a non-member → 403', async () => {
      const created = (await createTask('mona')).body;

      const response = await request(app)
        .get(`/api/tasks/${created.id}/history`)
        .set('Authorization', auth.hany);

      expect(response.status).toBe(403);
    });
  });
});
