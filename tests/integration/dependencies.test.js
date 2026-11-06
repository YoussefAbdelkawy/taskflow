const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const PASSWORD = 'secret123';

function addTeam(container) {
  const { user, project } = container.repositories;
  const passwordHash = container.passwordHasher.hash(PASSWORD);
  const addUser = (name) =>
    user.create({
      name,
      email: `${name.toLowerCase()}@taskflow.test`,
      passwordHash,
    });

  const team = {
    mona: addUser('Mona'),
    karim: addUser('Karim'),
    hany: addUser('Hany'),
  };

  const website = project.create({
    name: 'Website',
    description: '',
    startDate: '2026-10-01',
  });
  project.addMember({
    projectId: website.id,
    userId: team.mona.id,
    role: 'MANAGER',
  });
  project.addMember({
    projectId: website.id,
    userId: team.karim.id,
    role: 'MEMBER',
  });

  return { team, website };
}

describe('dependencies API (FR6)', () => {
  let app;
  let team;
  let website;
  let auth;
  let taskA;
  let taskB;

  const newTask = (overrides = {}) => ({
    title: 'Task',
    description: '',
    assigneeId: team.karim.id,
    dueDate: '2026-11-02',
    priority: 'MEDIUM',
    ...overrides,
  });

  const createTask = (as, body = newTask()) =>
    request(app)
      .post(`/api/projects/${website.id}/tasks`)
      .set('Authorization', auth[as])
      .send(body);

  const addDependency = (as, taskId, dependsOnId) =>
    request(app)
      .post(`/api/tasks/${taskId}/dependencies`)
      .set('Authorization', auth[as])
      .send({ dependsOnId });

  const getDependencies = (as, taskId) =>
    request(app).get(`/api/tasks/${taskId}/dependencies`).set('Authorization', auth[as]);

  const changeStatus = (as, taskId, status) =>
    request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', auth[as])
      .send({ status });

  beforeEach(async () => {
    const container = createContainer({ databasePath: ':memory:' });
    ({ team, website } = addTeam(container));
    app = createApp(container);

    auth = {};
    for (const name of Object.keys(team)) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: `${name}@taskflow.test`, password: PASSWORD });
      auth[name] = `Bearer ${response.body.token}`;
    }

    taskA = (await createTask('mona', newTask({ title: 'A' }))).body;
    taskB = (await createTask('mona', newTask({ title: 'B' }))).body;
  });

  it('US6-1: a manager adds B depends on A → 201, B is blocked', async () => {
    const created = await addDependency('mona', taskB.id, taskA.id);

    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      taskId: taskB.id,
      dependsOnId: taskA.id,
    });

    const response = await getDependencies('karim', taskB.id);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      prerequisites: [{ id: taskA.id, title: 'A', status: 'TO_DO' }],
      isBlocked: true,
    });

    const blocked = await changeStatus('karim', taskB.id, 'IN_PROGRESS');
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({ error: 'Task is blocked' });
  });

  it('US6-2: after A is Done, B can move to IN_PROGRESS', async () => {
    await addDependency('mona', taskB.id, taskA.id);
    await changeStatus('karim', taskA.id, 'DONE');

    const response = await changeStatus('karim', taskB.id, 'IN_PROGRESS');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('IN_PROGRESS');
  });

  it('US6-3: a cycle is rejected and the link table is unchanged', async () => {
    await addDependency('mona', taskB.id, taskA.id);

    const response = await addDependency('mona', taskA.id, taskB.id);
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Circular dependency' });

    expect((await getDependencies('karim', taskA.id)).body.prerequisites).toEqual([]);
    expect((await getDependencies('karim', taskB.id)).body.prerequisites).toHaveLength(1);
  });

  it('NFR Security: a member cannot add a dependency → 403', async () => {
    const response = await addDependency('karim', taskB.id, taskA.id);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Only a project manager can add dependencies',
    });
  });

  it('NFR Security: a non-member cannot read dependencies → 403', async () => {
    const response = await getDependencies('hany', taskB.id);

    expect(response.status).toBe(403);
  });

  it('without a token → 401', async () => {
    const response = await request(app)
      .post(`/api/tasks/${taskB.id}/dependencies`)
      .send({ dependsOnId: taskA.id });

    expect(response.status).toBe(401);
  });
});
