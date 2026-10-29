// FR2 through the real container: HTTP API, the real EventPublisher and SQLite.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');
const config = require('../../src/config');

const PASSWORD = 'secret123';

// Builds the few rows FR2 needs, straight through the repositories (seed data is not part of this turn).
function addWeeklyReportProject(container) {
  const { user, project, task } = container.repositories;
  const passwordHash = container.passwordHasher.hash(PASSWORD);
  const manager = user.create({ name: 'Mona', email: 'mona@taskflow.test', passwordHash });
  const member = user.create({ name: 'Omar', email: 'omar@taskflow.test', passwordHash });
  const website = project.create({ name: 'Website', description: '', startDate: '2026-10-01' });
  project.addMember({ projectId: website.id, userId: manager.id, role: 'MANAGER' });
  project.addMember({ projectId: website.id, userId: member.id, role: 'MEMBER' });
  const report = task.create({
    projectId: website.id,
    assigneeId: member.id,
    title: 'Weekly report',
    description: 'Send the numbers',
    priority: 'HIGH',
    dueDate: '2026-11-02',
  });
  return { manager, member, report };
}

describe('recurrence API', () => {
  let app;
  let report;

  beforeEach(() => {
    const container = createContainer({ databasePath: ':memory:' });
    ({ report } = addWeeklyReportProject(container));
    app = createApp(container);
  });

  const tokenFor = async (email) =>
    (await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).body.token;

  const url = () => `/api/tasks/${report.id}/recurrence`;

  it('PUT without a token → 401', async () => {
    const response = await request(app).put(url()).send({ frequency: 'WEEKLY' });

    expect(response.status).toBe(401);
  });

  it('PUT as a non-manager → 403', async () => {
    const token = await tokenFor('omar@taskflow.test');

    const response = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${token}`)
      .send({ frequency: 'WEEKLY' });

    expect(response.status).toBe(403);
  });

  it('a manager can set, read and turn off recurrence', async () => {
    const auth = `Bearer ${await tokenFor('mona@taskflow.test')}`;

    const set = await request(app)
      .put(url())
      .set('Authorization', auth)
      .send({ frequency: 'WEEKLY' });
    const read = await request(app).get(url()).set('Authorization', auth);
    const off = await request(app).delete(url()).set('Authorization', auth);

    expect(set.status).toBe(200);
    expect(set.body).toEqual({ taskId: report.id, frequency: 'WEEKLY', isActive: true });
    expect(read.status).toBe(200);
    expect(read.body).toEqual(set.body);
    expect(off.status).toBe(200);
    expect(off.body).toEqual({ taskId: report.id, frequency: 'WEEKLY', isActive: false });
  });

  it('a member can read the recurrence of a task in their project', async () => {
    const auth = `Bearer ${await tokenFor('omar@taskflow.test')}`;

    const response = await request(app).get(url()).set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ taskId: report.id, frequency: null, isActive: false });
  });

  it('an unknown frequency → 400 and an unknown task → 404', async () => {
    const auth = `Bearer ${await tokenFor('mona@taskflow.test')}`;

    const bad = await request(app).put(url()).set('Authorization', auth).send({ frequency: 'X' });
    const missing = await request(app).get('/api/tasks/999/recurrence').set('Authorization', auth);

    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'Unknown frequency' });
    expect(missing.status).toBe(404);
  });
});

describe('FR2 through the real container', () => {
  it('US2-1: a TASK_COMPLETED event on the container’s EventPublisher creates the next instance', () => {
    const container = createContainer({ databasePath: ':memory:' });
    const { manager, report } = addWeeklyReportProject(container);
    container.services.recurrence.setRecurring({
      taskId: report.id,
      frequency: 'WEEKLY',
      user: manager,
    });
    const current = container.repositories.task.findById(report.id);

    container.eventPublisher.publish({
      type: 'TASK_COMPLETED',
      task: { ...current, status: 'DONE' },
      actorId: manager.id,
      occurredAt: new Date().toISOString(),
    });

    const instances = container.repositories.task.findAll();
    expect(instances).toHaveLength(2);
    expect(instances[1]).toMatchObject({
      title: 'Weekly report',
      description: 'Send the numbers',
      assigneeId: current.assigneeId,
      recurrenceId: current.recurrenceId,
      status: 'TO_DO',
      dueDate: '2026-11-09',
    });
  });

  it('US2-2: a new container on the same database file (simulated restart) running runDue again → still one', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-'));
    const databasePath = path.join(folder, 'restart.db');
    const now = new Date('2026-11-03T00:00:30.000Z');
    try {
      const first = createContainer({ databasePath });
      const { manager, report } = addWeeklyReportProject(first);
      first.services.recurrence.setRecurring({
        taskId: report.id,
        frequency: 'WEEKLY',
        user: manager,
      });
      expect(first.services.recurrence.runDue(now)).toBe(1);
      first.db.close();

      const afterRestart = createContainer({ databasePath });
      expect(afterRestart.services.recurrence.runDue(now)).toBe(0);

      const dueDates = afterRestart.repositories.task.findAll().map((task) => task.dueDate);
      expect(dueDates).toEqual(['2026-11-02', '2026-11-09']);
      afterRestart.db.close();
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('builds a scheduler that runs every minute but does not start it', () => {
    const container = createContainer({ databasePath: ':memory:' });

    expect(config.schedulerIntervalMs).toBe(60000);
    expect(container.scheduler.intervalMs).toBe(config.schedulerIntervalMs);
    expect(container.scheduler.timer).toBeNull();
  });
});
