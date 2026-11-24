// FR7: the SQL aggregates behind the project report (US7-1). Real SQLite in memory.
const { createRepositories, userData, projectData, taskData } = require('./helpers');
const ReportRepository = require('../../../src/data-access/repositories/ReportRepository');
const TaskStatusHistoryRepository = require('../../../src/data-access/repositories/TaskStatusHistoryRepository');

const RANGE = { from: '2026-11-01', to: '2026-11-30' };

describe('ReportRepository (US7-1)', () => {
  let reports;
  let tasks;
  let history;
  let sara;
  let omar;
  let website;
  let other;

  beforeEach(() => {
    const { db, users, projects, tasks: taskRepository } = createRepositories();
    reports = new ReportRepository(db);
    tasks = taskRepository;
    history = new TaskStatusHistoryRepository(db);
    sara = users.create(userData('sara@taskflow.test'));
    omar = users.create({ ...userData('omar@taskflow.test'), name: 'Omar' });
    website = projects.create(projectData());
    other = projects.create({ ...projectData(), name: 'Other' });
  });

  const addTask = (overrides) =>
    tasks.create(taskData({ projectId: website.id, assigneeId: sara.id, ...overrides }));

  const complete = (task, changedAt) =>
    history.create({
      taskId: task.id,
      changedBy: sara.id,
      oldStatus: 'IN_PROGRESS',
      newStatus: 'DONE',
      changedAt,
    });

  it('US7-1 countByStatus counts only the project’s tasks due inside the range', () => {
    addTask({ status: 'TO_DO', dueDate: '2026-11-01' });
    addTask({ status: 'TO_DO', dueDate: '2026-11-30' });
    addTask({ status: 'DONE', dueDate: '2026-11-15' });
    addTask({ status: 'DONE', dueDate: '2026-12-01' }); // after the range
    addTask({ status: 'DONE', dueDate: '2026-10-31' }); // before the range
    tasks.create(taskData({ projectId: other.id, status: 'TO_DO', dueDate: '2026-11-10' }));

    const rows = reports.countByStatus({ projectId: website.id, ...RANGE });

    expect(rows).toEqual(
      expect.arrayContaining([
        { status: 'TO_DO', count: 2 },
        { status: 'DONE', count: 1 },
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it('US7-1 countCompletedByDay counts DONE changes per day inside the range', () => {
    const first = addTask({ status: 'DONE' });
    const second = addTask({ status: 'DONE' });
    const third = addTask({ status: 'DONE' });
    complete(first, '2026-11-03T09:00:00.000Z');
    complete(second, '2026-11-03T17:00:00.000Z');
    complete(third, '2026-11-20T10:00:00.000Z');
    complete(third, '2026-12-02T10:00:00.000Z'); // outside the range

    expect(reports.countCompletedByDay({ projectId: website.id, ...RANGE })).toEqual([
      { day: '2026-11-03', count: 2 },
      { day: '2026-11-20', count: 1 },
    ]);
  });

  it('US7-1 workloadByAssignee splits open and done tasks per member, unassigned last', () => {
    addTask({ status: 'TO_DO', dueDate: '2026-11-02' });
    addTask({ status: 'IN_PROGRESS', dueDate: '2026-11-03' });
    addTask({ status: 'DONE', dueDate: '2026-11-04' });
    addTask({ assigneeId: omar.id, status: 'TO_DO', dueDate: '2026-11-05' });
    addTask({ assigneeId: null, status: 'TO_DO', dueDate: '2026-11-06' });

    expect(reports.workloadByAssignee({ projectId: website.id, ...RANGE })).toEqual([
      { assigneeId: sara.id, name: 'Sara', open: 2, done: 1 },
      { assigneeId: omar.id, name: 'Omar', open: 1, done: 0 },
      { assigneeId: null, name: 'Unassigned', open: 1, done: 0 },
    ]);
  });

  it('US7-1 findOverdue lists open tasks due before today, oldest first, with the assignee', () => {
    const late = addTask({ title: 'Late', status: 'TO_DO', dueDate: '2026-11-05' });
    const later = addTask({ title: 'Later', status: 'IN_PROGRESS', dueDate: '2026-11-02' });
    addTask({ title: 'Done late', status: 'DONE', dueDate: '2026-11-01' });
    addTask({ title: 'Due today', status: 'TO_DO', dueDate: '2026-11-10' });

    const rows = reports.findOverdue({ projectId: website.id, ...RANGE, today: '2026-11-10' });

    expect(rows).toEqual([
      {
        id: later.id,
        title: 'Later',
        assigneeName: 'Sara',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        dueDate: '2026-11-02',
      },
      {
        id: late.id,
        title: 'Late',
        assigneeName: 'Sara',
        priority: 'MEDIUM',
        status: 'TO_DO',
        dueDate: '2026-11-05',
      },
    ]);
  });

  it('NFR7 the tasks table has an index on (project_id, due_date) for the report queries', () => {
    const { db } = createRepositories();
    const index = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_project_due'",
      )
      .get();

    expect(index?.sql).toMatch(/tasks\s*\(project_id, due_date\)/);
  });
});
