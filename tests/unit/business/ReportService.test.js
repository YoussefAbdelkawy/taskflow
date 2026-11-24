// FR7 business rules: who may see a report, which date ranges are valid, and the dashboard.
const ReportService = require('../../../src/business/services/ReportService');
const AuthorizationService = require('../../../src/business/services/AuthorizationService');
const InMemoryRepository = require('../../../src/data-access/repositories/InMemoryRepository');
const { InMemoryProjectRepository } = require('../helpers/inMemoryRepositories');
const {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} = require('../../../src/business/errors/AppError');

const TODAY = '2026-11-24';
const MANAGER = { id: 1, name: 'Mona' };
const MEMBER = { id: 2, name: 'Karim' };
const OUTSIDER = { id: 3, name: 'Hany' };

class InMemoryProjects extends InMemoryProjectRepository {
  findByUser(userId) {
    const ids = this.members.filter((m) => m.userId === userId).map((m) => m.projectId);
    return this.findAll().filter((project) => ids.includes(project.id));
  }
}

class InMemoryTasks extends InMemoryRepository {
  findByAssignee(userId) {
    return this.findAll().filter((task) => task.assigneeId === userId);
  }

  findByProject(projectId) {
    return this.findAll().filter((task) => task.projectId === projectId);
  }
}

// Records the queries and answers with fixed rows, like ReportRepository would.
const fakeReportRepository = () => {
  const calls = [];
  const answer = (name, rows) => (query) => {
    calls.push({ name, query });
    return rows;
  };
  return {
    calls,
    countByStatus: answer('countByStatus', [
      { status: 'DONE', count: 1 },
      { status: 'TO_DO', count: 1 },
    ]),
    countCompletedByDay: answer('countCompletedByDay', [{ day: '2026-11-20', count: 1 }]),
    workloadByAssignee: answer('workloadByAssignee', [
      { assigneeId: 2, name: 'Karim', open: 1, done: 1 },
    ]),
    findOverdue: answer('findOverdue', [
      {
        id: 3,
        title: 'Late, really',
        assigneeName: 'Karim',
        priority: 'HIGH',
        status: 'TO_DO',
        dueDate: '2026-11-20',
      },
    ]),
  };
};

function setup() {
  const projectRepository = new InMemoryProjects();
  const taskRepository = new InMemoryTasks();
  const reportRepository = fakeReportRepository();
  const website = projectRepository.create({
    name: 'Website Relaunch',
    description: '',
    startDate: '2026-10-01',
  });
  projectRepository.addMember({ projectId: website.id, userId: MANAGER.id, role: 'MANAGER' });
  projectRepository.addMember({ projectId: website.id, userId: MEMBER.id, role: 'MEMBER' });
  const service = new ReportService({
    reportRepository,
    projectRepository,
    taskRepository,
    authorizationService: new AuthorizationService({ projectRepository }),
    clock: () => new Date(`${TODAY}T15:00:00Z`),
  });
  return { service, website, projectRepository, taskRepository, reportRepository };
}

describe('ReportService.getProjectReport (US7-1)', () => {
  // Decision table: who asks × does the project exist → result
  it.each([
    ['manager', MANAGER, true, 'report'],
    ['member', MEMBER, true, ForbiddenError],
    ['non-member', OUTSIDER, true, ForbiddenError],
    ['manager', MANAGER, false, NotFoundError],
    ['member', MEMBER, false, NotFoundError],
    ['non-member', OUTSIDER, false, NotFoundError],
  ])('US7-1 AC1 decision table: %s, project exists = %s → %p', (_who, user, exists, expected) => {
    const { service, website } = setup();
    const projectId = exists ? website.id : 99;

    if (expected === 'report') {
      expect(service.getProjectReport(user, projectId).project.id).toBe(website.id);
    } else {
      expect(() => service.getProjectReport(user, projectId)).toThrow(expected);
    }
  });

  // Equivalence partitioning + boundary values on the date range (today = 2026-11-24)
  it.each([
    ['no dates → the last 30 days', {}, { from: '2026-10-26', to: TODAY }],
    [
      'only "to" → 30 days before it',
      { to: '2026-11-10' },
      { from: '2026-10-12', to: '2026-11-10' },
    ],
    ['only "from" → up to today', { from: '2026-11-01' }, { from: '2026-11-01', to: TODAY }],
    ['same day (1 day, lower boundary)', { from: TODAY, to: TODAY }, { from: TODAY, to: TODAY }],
    [
      '366 days (upper boundary)',
      { from: '2025-11-24', to: TODAY },
      { from: '2025-11-24', to: TODAY },
    ],
  ])('US7-1 valid range: %s', (_case, range, expected) => {
    const { service } = setup();

    expect(service.getProjectReport(MANAGER, 1, range).range).toEqual(expected);
  });

  it.each([
    ['367 days (just over the boundary)', { from: '2025-11-23', to: TODAY }, 'at most 366 days'],
    ['reversed (from after to)', { from: TODAY, to: '2026-11-23' }, 'before'],
    ['malformed from', { from: '24/11/2026', to: TODAY }, 'YYYY-MM-DD'],
    ['impossible to', { from: '2026-11-01', to: '2026-02-30' }, 'YYYY-MM-DD'],
    ['non-text from', { from: 20261101, to: TODAY }, 'YYYY-MM-DD'],
  ])('US7-1 invalid range → 400: %s', (_case, range, message) => {
    const { service } = setup();

    expect(() => service.getProjectReport(MANAGER, 1, range)).toThrow(ValidationError);
    expect(() => service.getProjectReport(MANAGER, 1, range)).toThrow(message);
  });

  it('US7-1 AC2 queries the repository with the project, the range and today', () => {
    const { service, reportRepository } = setup();

    service.getProjectReport(MANAGER, 1, { from: '2026-11-01', to: '2026-11-30' });

    const query = { projectId: 1, from: '2026-11-01', to: '2026-11-30' };
    expect(reportRepository.calls).toEqual(
      expect.arrayContaining([
        { name: 'countByStatus', query },
        { name: 'countCompletedByDay', query },
        { name: 'workloadByAssignee', query },
        { name: 'findOverdue', query: { ...query, today: TODAY } },
      ]),
    );
  });

  it('US7-1 assembles every section of the report', () => {
    const { service } = setup();

    const report = service.getProjectReport(MANAGER, 1, { from: '2026-11-16', to: '2026-11-24' });

    expect(report.summary).toEqual({ total: 2, done: 1, open: 1, overdue: 1, completionRate: 50 });
    expect(report.completionTrend).toEqual([
      { week: '2026-W47', count: 1 },
      { week: '2026-W48', count: 0 },
    ]);
    expect(report.workload).toHaveLength(1);
    expect(report.overdue[0]).toMatchObject({ id: 3, daysLate: 4 });
  });
});

describe('ReportService.exportProjectReport (US7-2)', () => {
  it('US7-2 AC1 names the file taskflow-<project>-<yyyy-mm-dd>.csv', () => {
    const { service } = setup();

    const file = service.exportProjectReport(MANAGER, 1, { format: 'csv' });

    expect(file.fileName).toBe('taskflow-website-relaunch-2026-11-24.csv');
    expect(file.contentType).toBe('text/csv; charset=utf-8');
    expect(file.body).toContain('TF-3,"Late, really",Karim,HIGH,TO_DO,2026-11-20,4');
  });

  it('US7-2 json format gives a .json file with the whole report', () => {
    const { service } = setup();

    const file = service.exportProjectReport(MANAGER, 1, { format: 'json' });

    expect(file.fileName).toBe('taskflow-website-relaunch-2026-11-24.json');
    expect(JSON.parse(file.body).summary.total).toBe(2);
  });

  it('US7-2 an unknown format → 400, a member → 403 (same rules as the report)', () => {
    const { service } = setup();

    expect(() => service.exportProjectReport(MANAGER, 1, { format: 'pdf' })).toThrow(
      ValidationError,
    );
    expect(() => service.exportProjectReport(MEMBER, 1, { format: 'csv' })).toThrow(ForbiddenError);
  });
});

describe('ReportService.getDashboard (US7-3)', () => {
  const addTask = (taskRepository, overrides) =>
    taskRepository.create({
      projectId: 1,
      assigneeId: MEMBER.id,
      title: 'Task',
      description: '',
      status: 'TO_DO',
      priority: 'MEDIUM',
      dueDate: TODAY,
      ...overrides,
    });

  it('US7-3 AC1 counts only my tasks', () => {
    const { service, taskRepository } = setup();
    addTask(taskRepository, {});
    addTask(taskRepository, { assigneeId: MANAGER.id });

    expect(service.getDashboard(MEMBER).stats.open).toBe(1);
  });

  // Boundary values around today for "overdue" and "due this week" (today = 2026-11-24)
  it.each([
    ['yesterday, open', '2026-11-23', 'TO_DO', { overdue: 1, dueThisWeek: 0 }],
    ['yesterday, done', '2026-11-23', 'DONE', { overdue: 0, dueThisWeek: 0 }],
    ['today', TODAY, 'IN_PROGRESS', { overdue: 0, dueThisWeek: 1 }],
    ['today + 6 (last day of the week)', '2026-11-30', 'TO_DO', { overdue: 0, dueThisWeek: 1 }],
    ['today + 7', '2026-12-01', 'TO_DO', { overdue: 0, dueThisWeek: 0 }],
  ])('US7-3 AC2 a task due %s', (_case, dueDate, status, expected) => {
    const { service, taskRepository } = setup();
    addTask(taskRepository, { dueDate, status });

    expect(service.getDashboard(MEMBER).stats).toMatchObject(expected);
  });

  it('US7-3 AC3 "Due soon" lists at most 6 open tasks, earliest first, with the project name', () => {
    const { service, taskRepository } = setup();
    const days = [
      '2026-11-30',
      '2026-11-20',
      '2026-12-05',
      '2026-11-25',
      '2026-12-01',
      '2026-11-26',
      '2026-12-10',
    ];
    days.forEach((dueDate, index) => addTask(taskRepository, { dueDate, title: `T${index}` }));
    addTask(taskRepository, { dueDate: '2026-11-01', status: 'DONE' });

    const { dueSoon } = service.getDashboard(MEMBER);

    expect(dueSoon).toHaveLength(6);
    expect(dueSoon.map((task) => task.dueDate)).toEqual([...days].sort().slice(0, 6));
    expect(dueSoon[0].projectName).toBe('Website Relaunch');
  });

  it('US7-3 shows each of my projects with its progress and whether I manage it', () => {
    const { service, taskRepository } = setup();
    addTask(taskRepository, { status: 'DONE' });
    addTask(taskRepository, { status: 'DONE' });
    addTask(taskRepository, { status: 'TO_DO' });

    expect(service.getDashboard(MANAGER).projects).toEqual([
      { id: 1, name: 'Website Relaunch', total: 3, done: 2, progress: 67, isManager: true },
    ]);
    expect(service.getDashboard(MEMBER).projects[0].isManager).toBe(false);
    expect(service.getDashboard(MEMBER).stats.done).toBe(2);
  });

  it('US7-3 a user without projects gets zeros and empty lists', () => {
    const { service } = setup();

    expect(service.getDashboard(OUTSIDER)).toEqual({
      stats: { open: 0, dueThisWeek: 0, overdue: 0, done: 0 },
      dueSoon: [],
      projects: [],
    });
  });
});
