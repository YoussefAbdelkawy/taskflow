// FR5 through the real app: GET /api/tasks with the real services and SQLite in memory.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const PASSWORD = 'secret123';

// Mona manages the project, Karim and Omar are members. Karim owns four tasks, Omar one.
function addTeamAndTasks(container) {
  const { user, project, task } = container.repositories;
  const passwordHash = container.passwordHasher.hash(PASSWORD);
  const addUser = (name) =>
    user.create({ name, email: `${name.toLowerCase()}@taskflow.test`, passwordHash });
  const team = { mona: addUser('Mona'), karim: addUser('Karim'), omar: addUser('Omar') };
  const website = project.create({ name: 'Website', description: '', startDate: '2026-10-01' });
  project.addMember({ projectId: website.id, userId: team.mona.id, role: 'MANAGER' });
  project.addMember({ projectId: website.id, userId: team.karim.id, role: 'MEMBER' });
  project.addMember({ projectId: website.id, userId: team.omar.id, role: 'MEMBER' });

  const addTask = (fields) =>
    task.create({ projectId: website.id, status: 'TO_DO', description: '', ...fields });
  addTask({
    title: 'High late',
    assigneeId: team.karim.id,
    priority: 'HIGH',
    dueDate: '2026-12-01',
  });
  addTask({
    title: 'High early',
    assigneeId: team.karim.id,
    priority: 'HIGH',
    dueDate: '2026-11-02',
  });
  addTask({
    title: 'Medium done',
    assigneeId: team.karim.id,
    priority: 'MEDIUM',
    status: 'DONE',
    dueDate: '2026-11-05',
  });
  addTask({ title: 'Low', assigneeId: team.karim.id, priority: 'LOW', dueDate: '2026-11-20' });
  addTask({
    title: 'Omar high',
    assigneeId: team.omar.id,
    priority: 'HIGH',
    dueDate: '2026-11-01',
  });
  return team;
}

describe('filter & sort API (FR5)', () => {
  let app;
  const auth = {};

  beforeEach(async () => {
    const container = createContainer({ databasePath: ':memory:' });
    const team = addTeamAndTasks(container);
    app = createApp(container);
    for (const name of Object.keys(team)) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: `${name}@taskflow.test`, password: PASSWORD });
      auth[name] = `Bearer ${response.body.token}`;
    }
  });

  const getTasks = (as, query = '') =>
    request(app).get(`/api/tasks${query}`).set('Authorization', auth[as]);
  const titles = (response) => response.body.map((task) => task.title);

  it('US5-1: filter by High → only High priority tasks are shown', async () => {
    const response = await getTasks('karim', '?priority=HIGH');

    expect(response.status).toBe(200);
    expect(titles(response)).toEqual(['High early', 'High late']);
  });

  it('US5-2: sort by due date ascending → the earliest due date appears first', async () => {
    const response = await getTasks('karim', '?sort=asc');

    expect(titles(response)).toEqual(['High early', 'Medium done', 'Low', 'High late']);
  });

  it('sort=desc → the latest due date appears first', async () => {
    const response = await getTasks('karim', '?sort=desc');

    expect(titles(response)).toEqual(['High late', 'Low', 'Medium done', 'High early']);
  });

  it('with no query: all my tasks, earliest first (default sort asc)', async () => {
    expect(titles(await getTasks('karim'))).toEqual([
      'High early',
      'Medium done',
      'Low',
      'High late',
    ]);
  });

  it('combines priority, status and sort', async () => {
    const response = await getTasks('karim', '?priority=HIGH&status=TO_DO&sort=desc');

    expect(titles(response)).toEqual(['High late', 'High early']);
  });

  it('an empty value (the "All" option) means no filter', async () => {
    expect(titles(await getTasks('karim', '?priority=&status=&sort=asc'))).toHaveLength(4);
  });

  it('US5-3: a filter that matches no tasks → 200 with an empty list, not an error', async () => {
    const response = await getTasks('karim', '?priority=MEDIUM&status=TO_DO');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('never returns another user’s tasks', async () => {
    expect(titles(await getTasks('omar', '?priority=HIGH'))).toEqual(['Omar high']);
    expect(await getTasks('mona').then((response) => response.body)).toEqual([]);
  });

  it.each([
    ['?priority=URGENT', 'Priority must be LOW, MEDIUM or HIGH'],
    ['?status=IN_REVIEW', 'Status must be TO_DO, IN_PROGRESS or DONE'],
    ['?sort=sideways', 'Sort must be asc or desc'],
  ])('%s → 400 with an error message', async (query, message) => {
    const response = await getTasks('karim', query);

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain(message);
  });

  it('without a token → 401', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
  });

  it('GET /api/tasks/mine still works (FR1 route not shadowed)', async () => {
    const response = await getTasks('karim', '/mine');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(4);
  });
});
