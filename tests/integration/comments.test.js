// Fady's comment flow through the real app and an in-memory SQLite database.
const { performance } = require('node:perf_hooks');
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const PASSWORD = 'secret123';

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
  const website = project.create({ name: 'Website', description: '', startDate: '2026-11-05' });
  project.addMember({ projectId: website.id, userId: team.mona.id, role: 'MANAGER' });
  project.addMember({ projectId: website.id, userId: team.karim.id, role: 'MEMBER' });
  project.addMember({ projectId: website.id, userId: team.omar.id, role: 'MEMBER' });
  return { team, website };
}

describe('comments API (Fady turn)', () => {
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

  const createTask = async () => {
    const response = await request(app)
      .post(`/api/projects/${website.id}/tasks`)
      .set('Authorization', auth.mona)
      .send({
        title: 'Prepare the weekly report',
        description: 'Collect the numbers',
        assigneeId: team.karim.id,
        dueDate: '2026-11-06',
        priority: 'MEDIUM',
      });
    expect(response.status).toBe(201);
    return response.body;
  };

  it('US4-1: saves and lists a non-empty comment with author name and timestamp', async () => {
    const task = await createTask();
    const created = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.karim)
      .send({ content: '  Started on this  ' });
    const listed = await request(app)
      .get(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.karim);

    expect(created.status).toBe(201);
    expect(created.body.content).toBe('Started on this');
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({
      content: 'Started on this',
      name: 'Karim',
      createdAt: expect.any(String),
    });
  });

  it('US4-2: rejects whitespace-only content and saves nothing', async () => {
    const task = await createTask();
    const rejected = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.karim)
      .send({ content: '   \n  ' });
    const listed = await request(app)
      .get(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.karim);

    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({ error: 'Comment cannot be empty' });
    expect(listed.body).toEqual([]);
  });

  it('US4-3: rejects a user outside the project and saves nothing', async () => {
    const task = await createTask();
    const rejected = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.hany)
      .send({ content: 'Outside the project' });
    const listed = await request(app)
      .get(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.karim);

    expect(rejected.status).toBe(403);
    expect(listed.body).toEqual([]);
  });

  it('NFR Responsiveness: POST then GET returns a comment in under 2 seconds', async () => {
    const task = await createTask();
    const startedAt = performance.now();
    const created = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.karim)
      .send({ content: 'Progress update' });
    const listed = await request(app)
      .get(`/api/tasks/${task.id}/comments`)
      .set('Authorization', auth.karim);
    const elapsedMs = performance.now() - startedAt;

    expect(created.status).toBe(201);
    expect(listed.status).toBe(200);
    expect(elapsedMs).toBeLessThan(2000);
  });
});
