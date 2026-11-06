const { createRepositories, userData, projectData, taskData } = require('./helpers');

describe('TaskRepository', () => {
  let users;
  let projects;
  let tasks;
  let rules;

  beforeEach(() => {
    ({ users, projects, tasks, rules } = createRepositories());
    users.create(userData());
    users.create(userData('omar@taskflow.test'));
    projects.create(projectData());
    projects.create({ ...projectData(), name: 'Other' });
  });

  it('create → findById round trip with camelCase keys', () => {
    const created = tasks.create(taskData({ assigneeId: 1 }));

    expect(created).toEqual({ id: 1, ...taskData({ assigneeId: 1 }) });
    expect(tasks.findById(created.id)).toEqual(created);
  });

  it('uses the database defaults for status and description', () => {
    const required = { projectId: 1, title: 'Plan', priority: 'LOW', dueDate: '2026-11-02' };

    expect(tasks.create(required)).toMatchObject({
      status: 'TO_DO',
      description: '',
      assigneeId: null,
      recurrenceId: null,
    });
  });

  it('updates, lists and deletes tasks', () => {
    const created = tasks.create(taskData());

    expect(tasks.update(created.id, { status: 'DONE' })).toEqual({ ...created, status: 'DONE' });
    expect(tasks.update(99, { status: 'DONE' })).toBeNull();
    expect(tasks.findAll()).toHaveLength(1);
    expect(tasks.delete(created.id)).toBe(true);
    expect(tasks.findById(created.id)).toBeNull();
  });

  it('findByProject returns only that project’s tasks', () => {
    const inFirst = tasks.create(taskData({ projectId: 1 }));
    tasks.create(taskData({ projectId: 2 }));

    expect(tasks.findByProject(1)).toEqual([inFirst]);
  });

  it('findByAssignee returns only that user’s tasks', () => {
    const forSara = tasks.create(taskData({ assigneeId: 1 }));
    tasks.create(taskData({ assigneeId: 2 }));
    tasks.create(taskData({ assigneeId: null }));

    expect(tasks.findByAssignee(1)).toEqual([forSara]);
  });

  it('findLatestByRecurrence picks the latest due date', () => {
    const rule = rules.create({ frequency: 'WEEKLY', isActive: true, lastGeneratedPeriod: null });
    tasks.create(taskData({ recurrenceId: rule.id, dueDate: '2026-11-09' }));
    const latest = tasks.create(taskData({ recurrenceId: rule.id, dueDate: '2026-11-16' }));
    tasks.create(taskData({ recurrenceId: rule.id, dueDate: '2026-11-02' }));
    tasks.create(taskData({ dueDate: '2027-01-01' }));

    expect(tasks.findLatestByRecurrence(rule.id)).toEqual(latest);
    expect(tasks.findLatestByRecurrence(99)).toBeNull();
  });

  it('findByRecurrenceAndDueDate finds the instance for one period, or null', () => {
    const rule = rules.create({ frequency: 'WEEKLY', isActive: true, lastGeneratedPeriod: null });
    const instance = tasks.create(taskData({ recurrenceId: rule.id, dueDate: '2026-11-09' }));

    expect(
      tasks.findByRecurrenceAndDueDate({ recurrenceId: rule.id, dueDate: '2026-11-09' }),
    ).toEqual(instance);
    expect(
      tasks.findByRecurrenceAndDueDate({ recurrenceId: rule.id, dueDate: '2026-11-16' }),
    ).toBeNull();
  });

  describe('findTasks (FR5: filtering happens in the SQL query)', () => {
    let highTodo;
    let highDone;
    let lowTodo;

    beforeEach(() => {
      highTodo = tasks.create(taskData({ assigneeId: 1, priority: 'HIGH', status: 'TO_DO' }));
      highDone = tasks.create(taskData({ assigneeId: 1, priority: 'HIGH', status: 'DONE' }));
      lowTodo = tasks.create(taskData({ assigneeId: 1, priority: 'LOW', status: 'TO_DO' }));
      tasks.create(taskData({ assigneeId: 2, priority: 'HIGH', status: 'TO_DO' }));
      tasks.create(taskData({ assigneeId: null, priority: 'HIGH', status: 'TO_DO' }));
    });

    const ids = (list) => list.map((task) => task.id).sort((a, b) => a - b);

    it('with only an assignee returns all of that user’s tasks', () => {
      expect(ids(tasks.findTasks({ assigneeId: 1 }))).toEqual(ids([highTodo, highDone, lowTodo]));
    });

    it('US5-1: filters by priority', () => {
      expect(ids(tasks.findTasks({ assigneeId: 1, priority: 'HIGH' }))).toEqual(
        ids([highTodo, highDone]),
      );
    });

    it('filters by status', () => {
      expect(ids(tasks.findTasks({ assigneeId: 1, status: 'TO_DO' }))).toEqual(
        ids([highTodo, lowTodo]),
      );
    });

    it('combines priority and status', () => {
      expect(tasks.findTasks({ assigneeId: 1, priority: 'HIGH', status: 'DONE' })).toEqual([
        highDone,
      ]);
    });

    it('never returns another user’s tasks', () => {
      const found = tasks.findTasks({ assigneeId: 1, priority: 'HIGH' });

      expect(found.every((task) => task.assigneeId === 1)).toBe(true);
    });

    it('US5-3: returns an empty array when nothing matches', () => {
      expect(tasks.findTasks({ assigneeId: 1, priority: 'MEDIUM' })).toEqual([]);
    });

    it('treats a filter value as data, not SQL', () => {
      expect(tasks.findTasks({ assigneeId: 1, priority: "HIGH' OR '1'='1" })).toEqual([]);
    });
  });

  it('inserting two tasks with the same (recurrence_id, due_date) throws', () => {
    // Checked in the terminal first: node:sqlite throws a plain Error with
    //   message: 'UNIQUE constraint failed: tasks.recurrence_id, tasks.due_date'
    //   code:    'ERR_SQLITE_ERROR'
    //   errcode: 2067  (SQLITE_CONSTRAINT_UNIQUE)
    const rule = rules.create({ frequency: 'WEEKLY', isActive: true, lastGeneratedPeriod: null });
    tasks.create(taskData({ recurrenceId: rule.id, dueDate: '2026-11-09' }));

    expect(() => tasks.create(taskData({ recurrenceId: rule.id, dueDate: '2026-11-09' }))).toThrow(
      expect.objectContaining({
        message: 'UNIQUE constraint failed: tasks.recurrence_id, tasks.due_date',
        code: 'ERR_SQLITE_ERROR',
        errcode: 2067,
      }),
    );
  });
});
