// FR7 through the real app: report, CSV export and dashboard over HTTP with SQLite in memory.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const PASSWORD = 'secret123';
const daysFromToday = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const today = () => daysFromToday(0);

function addTeam(container) {
  const { user, project, task } = container.repositories;
  const passwordHash = container.passwordHasher.hash(PASSWORD);
  const addUser = (name) =>
    user.create({ name, email: `${name.toLowerCase()}@taskflow.test`, passwordHash });
  const team = { mona: addUser('Mona'), karim: addUser('Karim'), hany: addUser('Hany') };
  const website = project.create({
    name: 'Website, "v2"',
    description: '',
    startDate: '2026-01-01',
  });
  project.addMember({ projectId: website.id, userId: team.mona.id, role: 'MANAGER' });
  project.addMember({ projectId: website.id, userId: team.karim.id, role: 'MEMBER' });
  task.create({
    projectId: website.id,
    assigneeId: team.karim.id,
    title: 'Fix the "login", bug',
    description: '',
    status: 'TO_DO',
    priority: 'HIGH',
    dueDate: daysFromToday(-3),
  });
  return { team, website };
}

describe('reports API (FR7)', () => {
  let app;
  let website;
  const auth = {};

  beforeEach(async () => {
    const container = createContainer({ databasePath: ':memory:' });
    ({ website } = addTeam(container));
    app = createApp(container);
    for (const name of ['mona', 'karim', 'hany']) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: `${name}@taskflow.test`, password: PASSWORD });
      auth[name] = `Bearer ${response.body.token}`;
    }
  });

  const get = (as, url) => {
    const call = request(app).get(url);
    return as ? call.set('Authorization', auth[as]) : call;
  };

  describe('GET /api/projects/:id/report', () => {
    it('US7-1 a manager gets the report for the range', async () => {
      const response = await get('mona', `/api/projects/${website.id}/report`);

      expect(response.status).toBe(200);
      expect(response.body.summary).toMatchObject({ total: 1, open: 1, overdue: 1 });
      expect(response.body.overdue[0].title).toBe('Fix the "login", bug');
    });

    it.each([
      ['no token', null, 401],
      ['a member', 'karim', 403],
      ['a non-member', 'hany', 403],
    ])('US7-1 AC1 %s → %i', async (_case, as, status) => {
      expect((await get(as, `/api/projects/${website.id}/report`)).status).toBe(status);
    });

    it('US7-1 an unknown project → 404, a reversed range → 400', async () => {
      expect((await get('mona', '/api/projects/99/report')).status).toBe(404);
      const reversed = await get(
        'mona',
        `/api/projects/${website.id}/report?from=2026-11-24&to=2026-11-01`,
      );
      expect(reversed.status).toBe(400);
      expect(reversed.body.error).toMatch(/before/);
    });
  });

  describe('GET /api/projects/:id/report.csv', () => {
    it('US7-2 downloads the CSV with an attachment file name and escaped cells', async () => {
      const response = await get('mona', `/api/projects/${website.id}/report.csv`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^text\/csv/);
      expect(response.headers['content-disposition']).toMatch(/^attachment; filename=/);
      expect(response.headers['content-disposition']).toContain(
        `taskflow-website-v2-${today()}.csv`,
      );
      expect(response.text.split('\r\n')[0]).toBe(
        'ID,Title,Assignee,Priority,Status,Due date,Days late',
      );
      expect(response.text).toContain('"Fix the ""login"", bug",Karim,HIGH');
    });

    it('US7-2 a member → 403 with a JSON error', async () => {
      const response = await get('karim', `/api/projects/${website.id}/report.csv`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/manager/);
    });
  });

  describe('GET /api/dashboard', () => {
    it('US7-3 returns my counts, my next tasks and my projects', async () => {
      const response = await get('karim', '/api/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.stats).toEqual({ open: 1, dueThisWeek: 0, overdue: 1, done: 0 });
      expect(response.body.dueSoon[0]).toMatchObject({
        title: 'Fix the "login", bug',
        projectName: 'Website, "v2"',
      });
      expect(response.body.projects[0]).toMatchObject({ isManager: false, progress: 0 });
    });

    it('US7-3 needs a login → 401', async () => {
      expect((await get(null, '/api/dashboard')).status).toBe(401);
    });
  });
});

describe('NFR7 Performance: a report over 1,000 tasks', () => {
  const TASK_COUNT = 1000;
  const LIMIT_MS = 1000;
  const STATUSES = ['TO_DO', 'IN_PROGRESS', 'DONE'];

  it('NFR7 US7-1 is built in under 1 second', () => {
    const container = createContainer({ databasePath: ':memory:' });
    const { user, project, task, taskStatusHistory } = container.repositories;
    const mona = user.create({ name: 'Mona', email: 'mona@taskflow.test', passwordHash: 'x:y' });
    const site = project.create({ name: 'Big', description: '', startDate: '2026-01-01' });
    project.addMember({ projectId: site.id, userId: mona.id, role: 'MANAGER' });
    for (let index = 0; index < TASK_COUNT; index += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + (index % 300))).toISOString().slice(0, 10);
      const saved = task.create({
        projectId: site.id,
        assigneeId: mona.id,
        title: `Task ${index}`,
        description: '',
        status: STATUSES[index % STATUSES.length],
        priority: 'MEDIUM',
        dueDate: day,
      });
      if (saved.status === 'DONE') {
        taskStatusHistory.create({
          taskId: saved.id,
          changedBy: mona.id,
          oldStatus: 'IN_PROGRESS',
          newStatus: 'DONE',
          changedAt: `${day}T12:00:00.000Z`,
        });
      }
    }

    const start = performance.now();
    const report = container.services.report.getProjectReport(mona, site.id, {
      from: '2026-01-01',
      to: '2026-12-31',
    });
    const elapsed = performance.now() - start;

    expect(report.summary.total).toBe(TASK_COUNT);
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });
});
