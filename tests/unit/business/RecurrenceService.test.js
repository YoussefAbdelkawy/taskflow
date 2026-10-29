const RecurrenceService = require('../../../src/business/services/RecurrenceService');
const TaskObserver = require('../../../src/business/events/TaskObserver');
const EventPublisher = require('../../../src/business/events/EventPublisher');
const EventNames = require('../../../src/business/events/eventNames');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require('../../../src/business/errors/AppError');
const {
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryRecurrenceRuleRepository,
} = require('../helpers/inMemoryRepositories');

const PROJECT_ID = 1;
const manager = { id: 10, name: 'Mona', email: 'mona@taskflow.test' };
const member = { id: 20, name: 'Omar', email: 'omar@taskflow.test' };
const outsider = { id: 30, name: 'Zed', email: 'zed@taskflow.test' };

const weeklyReport = (overrides = {}) => ({
  projectId: PROJECT_ID,
  assigneeId: member.id,
  recurrenceId: null,
  title: 'Weekly report',
  description: 'Send the numbers to the client',
  status: 'TO_DO',
  priority: 'HIGH',
  dueDate: '2026-11-02', // a Monday
  ...overrides,
});

describe('RecurrenceService', () => {
  let tasks;
  let rules;
  let service;

  beforeEach(() => {
    const projects = new InMemoryProjectRepository([{ name: 'Website' }]);
    projects.addMember({ projectId: PROJECT_ID, userId: manager.id, role: 'MANAGER' });
    projects.addMember({ projectId: PROJECT_ID, userId: member.id, role: 'MEMBER' });
    tasks = new InMemoryTaskRepository();
    rules = new InMemoryRecurrenceRuleRepository();
    service = new RecurrenceService({
      recurrenceRuleRepository: rules,
      taskRepository: tasks,
      projectRepository: projects,
    });
  });

  const makeRecurring = (frequency = 'WEEKLY', overrides = {}) => {
    const task = tasks.create(weeklyReport(overrides));
    service.setRecurring({ taskId: task.id, frequency, user: manager });
    return tasks.findById(task.id);
  };

  const instancesOf = (recurrenceId) =>
    tasks.findAll().filter((task) => task.recurrenceId === recurrenceId);

  const completed = (task) => ({
    type: EventNames.TASK_COMPLETED,
    task: { ...task, status: 'DONE' },
    actorId: member.id,
    occurredAt: '2026-11-02T10:00:00.000Z',
  });

  it('is a TaskObserver', () => {
    expect(service).toBeInstanceOf(TaskObserver);
  });

  describe('setRecurring', () => {
    it('creates an active rule and links the task to it', () => {
      const task = tasks.create(weeklyReport());

      const result = service.setRecurring({ taskId: task.id, frequency: 'WEEKLY', user: manager });

      const linked = tasks.findById(task.id);
      expect(result).toEqual({ taskId: task.id, frequency: 'WEEKLY', isActive: true });
      expect(rules.findById(linked.recurrenceId)).toEqual({
        id: linked.recurrenceId,
        frequency: 'WEEKLY',
        isActive: true,
        lastGeneratedPeriod: null,
      });
    });

    it('updates the existing rule instead of creating a second one', () => {
      const task = makeRecurring('WEEKLY');
      service.turnOff({ taskId: task.id, user: manager });

      const result = service.setRecurring({ taskId: task.id, frequency: 'DAILY', user: manager });

      expect(result).toEqual({ taskId: task.id, frequency: 'DAILY', isActive: true });
      expect(rules.findAll()).toHaveLength(1);
      expect(rules.findById(task.recurrenceId)).toMatchObject({
        frequency: 'DAILY',
        isActive: true,
      });
    });

    it('throws NotFoundError for a missing task', () => {
      expect(() => service.setRecurring({ taskId: 99, frequency: 'DAILY', user: manager })).toThrow(
        NotFoundError,
      );
    });

    it('rejects a member who is not a manager with ForbiddenError', () => {
      const task = tasks.create(weeklyReport());

      expect(() =>
        service.setRecurring({ taskId: task.id, frequency: 'DAILY', user: member }),
      ).toThrow(ForbiddenError);
      expect(() =>
        service.setRecurring({ taskId: task.id, frequency: 'DAILY', user: outsider }),
      ).toThrow(ForbiddenError);
      expect(rules.findAll()).toEqual([]);
    });

    it('rejects an invalid frequency with ValidationError', () => {
      const task = tasks.create(weeklyReport());

      expect(() =>
        service.setRecurring({ taskId: task.id, frequency: 'YEARLY', user: manager }),
      ).toThrow(ValidationError);
      expect(rules.findAll()).toEqual([]);
    });
  });

  describe('turnOff', () => {
    it('sets the rule inactive and returns the turned-off state', () => {
      const task = makeRecurring('WEEKLY');

      const result = service.turnOff({ taskId: task.id, user: manager });

      expect(result).toEqual({ taskId: task.id, frequency: 'WEEKLY', isActive: false });
      expect(rules.findById(task.recurrenceId).isActive).toBe(false);
    });

    it('throws NotFoundError when the task is not recurring', () => {
      const task = tasks.create(weeklyReport());

      expect(() => service.turnOff({ taskId: task.id, user: manager })).toThrow(
        new NotFoundError('Task is not recurring'),
      );
    });

    it('has the same checks as setRecurring', () => {
      const task = makeRecurring('WEEKLY');

      expect(() => service.turnOff({ taskId: 99, user: manager })).toThrow(NotFoundError);
      expect(() => service.turnOff({ taskId: task.id, user: member })).toThrow(ForbiddenError);
    });
  });

  describe('getRecurrence', () => {
    it('returns the rule for any project member', () => {
      const task = makeRecurring('MONTHLY');

      expect(service.getRecurrence({ taskId: task.id, user: member })).toEqual({
        taskId: task.id,
        frequency: 'MONTHLY',
        isActive: true,
      });
    });

    it('returns frequency null and isActive false when there is no rule', () => {
      const task = tasks.create(weeklyReport());

      expect(service.getRecurrence({ taskId: task.id, user: member })).toEqual({
        taskId: task.id,
        frequency: null,
        isActive: false,
      });
    });

    it('throws NotFoundError for a missing task and ForbiddenError for a non-member', () => {
      const task = tasks.create(weeklyReport());

      expect(() => service.getRecurrence({ taskId: 99, user: member })).toThrow(NotFoundError);
      expect(() => service.getRecurrence({ taskId: task.id, user: outsider })).toThrow(
        ForbiddenError,
      );
    });
  });

  describe('US2-1', () => {
    it('US2-1: given a weekly task due Monday, when it is marked Done, then a new instance with the same title, description and assignee is created, due the following Monday', () => {
      const publisher = new EventPublisher();
      publisher.subscribe(service);
      const current = makeRecurring('WEEKLY');

      publisher.publish(completed(current));

      const next = instancesOf(current.recurrenceId).filter((task) => task.id !== current.id);
      expect(next).toHaveLength(1);
      expect(next[0]).toEqual({
        id: next[0].id,
        projectId: PROJECT_ID,
        assigneeId: member.id,
        recurrenceId: current.recurrenceId,
        title: 'Weekly report',
        description: 'Send the numbers to the client',
        priority: 'HIGH',
        status: 'TO_DO',
        dueDate: '2026-11-09',
      });
      expect(rules.findById(current.recurrenceId).lastGeneratedPeriod).toBe('2026-11-09');
    });

    it('ignores other events and tasks without a recurrence', () => {
      const current = makeRecurring('WEEKLY');
      const plain = tasks.create(weeklyReport({ title: 'One-off' }));

      service.onTaskEvent({ ...completed(current), type: EventNames.TASK_STATUS_CHANGED });
      service.onTaskEvent({ ...completed(current), type: EventNames.TASK_ASSIGNED });
      service.onTaskEvent(completed(plain));

      expect(tasks.findAll()).toHaveLength(2);
    });
  });

  describe('US2-2', () => {
    it('US2-2: does not create a second instance when generateNext runs twice for the same instance', () => {
      const current = makeRecurring('WEEKLY');

      const first = service.generateNext(current);
      const second = service.generateNext(current);

      expect(first).toMatchObject({ dueDate: '2026-11-09' });
      expect(second).toBeNull();
      expect(instancesOf(current.recurrenceId)).toHaveLength(2);
    });

    it('US2-2: does not create a second instance when the instance for that period already exists', () => {
      const current = makeRecurring('WEEKLY');
      tasks.create(weeklyReport({ recurrenceId: current.recurrenceId, dueDate: '2026-11-09' }));

      expect(service.generateNext(current)).toBeNull();
      expect(instancesOf(current.recurrenceId)).toHaveLength(2);
    });

    it('US2-2: running runDue twice in a row creates no duplicates', () => {
      const current = makeRecurring('WEEKLY');
      const now = new Date('2026-11-03T00:00:30.000Z'); // the day after the due date

      const firstRun = service.runDue(now);
      const secondRun = service.runDue(now);

      expect(firstRun).toBe(1);
      expect(secondRun).toBe(0);
      expect(
        instancesOf(current.recurrenceId)
          .map((task) => task.dueDate)
          .sort(),
      ).toEqual(['2026-11-02', '2026-11-09']);
    });

    it('US2-2: returns null when the database rejects a duplicate period (UNIQUE constraint)', () => {
      const current = makeRecurring('WEEKLY');
      // The real error node:sqlite throws for UNIQUE (see TaskRepository integration test).
      const duplicate = Object.assign(
        new Error('UNIQUE constraint failed: tasks.recurrence_id, tasks.due_date'),
        { code: 'ERR_SQLITE_ERROR', errcode: 2067 },
      );
      jest.spyOn(tasks, 'create').mockImplementation(() => {
        throw duplicate;
      });

      expect(service.generateNext(current)).toBeNull();
      expect(rules.findById(current.recurrenceId).lastGeneratedPeriod).toBeNull();
    });

    it('rethrows any other error from create', () => {
      const current = makeRecurring('WEEKLY');
      jest.spyOn(tasks, 'create').mockImplementation(() => {
        throw Object.assign(new Error('CHECK constraint failed'), { errcode: 275 });
      });

      expect(() => service.generateNext(current)).toThrow('CHECK constraint failed');
    });
  });

  describe('US2-3', () => {
    it('US2-3: given a recurring task, when the manager turns recurrence off, then the current instance stays and no new ones are created', () => {
      const current = makeRecurring('WEEKLY');
      const before = tasks.findById(current.id);

      service.turnOff({ taskId: current.id, user: manager });
      service.onTaskEvent(completed(current));
      const created = service.runDue(new Date('2026-12-01T00:00:00.000Z'));

      expect(created).toBe(0);
      expect(tasks.findAll()).toEqual([before]);
    });
  });

  describe('runDue (the due date passes)', () => {
    it('creates the next instance only once the due date is before today (UTC)', () => {
      const current = makeRecurring('DAILY');

      expect(service.runDue(new Date('2026-11-02T23:59:59.000Z'))).toBe(0);
      expect(service.runDue(new Date('2026-11-03T00:00:00.000Z'))).toBe(1);
      expect(service.generateNext(current)).toBeNull();
    });

    it('skips an instance that is already DONE', () => {
      const current = makeRecurring('WEEKLY');
      tasks.update(current.id, { status: 'DONE' });

      expect(service.runDue(new Date('2026-11-20T00:00:00.000Z'))).toBe(0);
    });

    it('works from the latest instance of each active rule', () => {
      makeRecurring('WEEKLY');
      makeRecurring('MONTHLY', { title: 'Invoice', dueDate: '2026-10-31' });

      expect(service.runDue(new Date('2026-11-05T00:00:00.000Z'))).toBe(2);
      expect(
        tasks
          .findAll()
          .map((task) => task.dueDate)
          .sort(),
      ).toEqual(['2026-10-31', '2026-11-02', '2026-11-09', '2026-11-30']);
    });
  });
});
