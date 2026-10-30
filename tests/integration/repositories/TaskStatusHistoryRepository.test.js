const { createRepositories, userData, projectData, taskData } = require('./helpers');
const TaskStatusHistoryRepository = require('../../../src/data-access/repositories/TaskStatusHistoryRepository');

describe('TaskStatusHistoryRepository', () => {
  let history;
  let user;
  let task;
  let otherTask;

  beforeEach(() => {
    const { db, users, projects, tasks } = createRepositories();
    history = new TaskStatusHistoryRepository(db);
    user = users.create(userData()); // name Sara
    projects.create(projectData());
    task = tasks.create(taskData({ assigneeId: user.id }));
    otherTask = tasks.create(taskData({ assigneeId: user.id }));
  });

  const entryData = (overrides = {}) => ({
    taskId: task.id,
    changedBy: user.id,
    oldStatus: 'TO_DO',
    newStatus: 'IN_PROGRESS',
    changedAt: '2026-10-30T09:00:00.000Z',
    ...overrides,
  });

  it('create → findById round trip with camelCase keys and the name of who changed it', () => {
    const created = history.create(entryData());

    expect(created).toEqual({ id: expect.any(Number), ...entryData(), changedByName: 'Sara' });
    expect(history.findById(created.id)).toEqual(created);
    expect(history.findById(99)).toBeNull();
  });

  it('findByTask returns only that task’s entries, oldest first', () => {
    const later = history.create(
      entryData({
        oldStatus: 'IN_PROGRESS',
        newStatus: 'DONE',
        changedAt: '2026-10-30T11:00:00.000Z',
      }),
    );
    const earlier = history.create(entryData({ changedAt: '2026-10-30T09:00:00.000Z' }));
    history.create(entryData({ taskId: otherTask.id }));

    expect(history.findByTask(task.id)).toEqual([earlier, later]);
  });

  it('findByTask keeps creation order for entries with the same changedAt', () => {
    const sameTime = '2026-10-30T09:00:00.000Z';
    const first = history.create(entryData({ changedAt: sameTime }));
    const second = history.create(
      entryData({ oldStatus: 'IN_PROGRESS', newStatus: 'DONE', changedAt: sameTime }),
    );

    expect(history.findByTask(task.id)).toEqual([first, second]);
  });

  it('findByTask returns an empty array for a task with no changes', () => {
    expect(history.findByTask(otherTask.id)).toEqual([]);
  });

  it('rejects an entry with a missing field (all columns are NOT NULL)', () => {
    expect(() => history.create(entryData({ changedAt: null }))).toThrow(/NOT NULL/);
  });
});
