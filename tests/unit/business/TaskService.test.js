const TaskService = require('../../../src/business/services/TaskService');
const AuthorizationService = require('../../../src/business/services/AuthorizationService');
const InMemoryRepository = require('../../../src/data-access/repositories/InMemoryRepository');
const {
  InMemoryProjectRepository,
  InMemoryTaskRepository,
} = require('../helpers/inMemoryRepositories');
const {
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
} = require('../../../src/business/errors/AppError');
const { TaskStatus, Priority, Role } = require('../../../src/domain/enums');
const EventNames = require('../../../src/business/events/eventNames');

// The shared fake has no list queries yet; these behave like TaskRepository's.
class InMemoryTaskRepositoryWithLists extends InMemoryTaskRepository {
  findByAssignee(userId) {
    return this.findAll().filter((task) => task.assigneeId === userId);
  }
}

// Records every published event instead of calling observers.
class RecordingPublisher {
  constructor() {
    this.events = [];
  }

  publish(event) {
    this.events.push(event);
  }
}

const PROJECT_ID = 1;
const OTHER_PROJECT_ID = 2;
const mona = { id: 10, name: 'Mona', email: 'mona@taskflow.test' }; // manager
const karim = { id: 11, name: 'Karim', email: 'karim@taskflow.test' }; // member
const hany = { id: 12, name: 'Hany', email: 'hany@taskflow.test' }; // member of another project only
const omar = { id: 13, name: 'Omar', email: 'omar@taskflow.test' }; // member, not the assignee

describe('TaskService', () => {
  let projectRepository;
  let taskRepository;
  let historyRepository;
  let eventPublisher;
  let service;

  const makeService = (dependencyService) =>
    new TaskService({
      taskRepository,
      historyRepository,
      authorizationService: new AuthorizationService({ projectRepository }),
      eventPublisher,
      dependencyService,
    });

  beforeEach(() => {
    projectRepository = new InMemoryProjectRepository();
    projectRepository.addMember({ projectId: PROJECT_ID, userId: mona.id, role: Role.MANAGER });
    projectRepository.addMember({ projectId: PROJECT_ID, userId: karim.id, role: Role.MEMBER });
    projectRepository.addMember({ projectId: PROJECT_ID, userId: omar.id, role: Role.MEMBER });
    projectRepository.addMember({
      projectId: OTHER_PROJECT_ID,
      userId: hany.id,
      role: Role.MEMBER,
    });
    taskRepository = new InMemoryTaskRepositoryWithLists();
    historyRepository = new InMemoryRepository();
    eventPublisher = new RecordingPublisher();
    service = makeService();
  });

  const newTask = (overrides = {}) => ({
    projectId: PROJECT_ID,
    title: 'Design the home page',
    description: 'Hero section and footer',
    assigneeId: karim.id,
    dueDate: '2026-11-02',
    priority: Priority.HIGH,
    ...overrides,
  });

  describe('createTask', () => {
    it('US1-1: manager creates a task with title, assignee, due date, priority → saved as TO_DO, in the assignee’s list', () => {
      const task = service.createTask(newTask(), mona);

      expect(task).toEqual({ id: expect.any(Number), ...newTask(), status: TaskStatus.TO_DO });
      expect(taskRepository.findById(task.id)).toEqual(task);
      expect(taskRepository.findByAssignee(karim.id)).toEqual([task]);
    });

    it('US1-1: publishes TASK_ASSIGNED with the task, who did it and when', () => {
      const task = service.createTask(newTask(), mona);

      expect(eventPublisher.events).toEqual([
        {
          type: EventNames.TASK_ASSIGNED,
          task,
          actorId: mona.id,
          occurredAt: expect.any(String),
        },
      ]);
      expect(new Date(eventPublisher.events[0].occurredAt).toISOString()).toBe(
        eventPublisher.events[0].occurredAt,
      );
    });

    it('saves a missing description as an empty string (tasks.description is NOT NULL)', () => {
      const task = service.createTask(newTask({ description: undefined }), mona);

      expect(task.description).toBe('');
      expect(taskRepository.findById(task.id).description).toBe('');
    });

    it('NFR Security: a member (not manager) creating a task → 403, nothing saved, no event', () => {
      expect(() => service.createTask(newTask(), karim)).toThrow(ForbiddenError);
      expect(taskRepository.findAll()).toEqual([]);
      expect(eventPublisher.events).toEqual([]);
    });

    it('NFR Security: a user outside the project creating a task → 403', () => {
      expect(() => service.createTask(newTask(), hany)).toThrow(ForbiddenError);
    });

    it('NFR Security: a non-manager gets 403 even when the input is also invalid', () => {
      expect(() => service.createTask(newTask({ title: '' }), karim)).toThrow(ForbiddenError);
    });

    it('rejects an assignee outside the project with 400', () => {
      expect(() => service.createTask(newTask({ assigneeId: hany.id }), mona)).toThrow(
        ValidationError,
      );
      expect(taskRepository.findAll()).toEqual([]);
    });

    it('rejects a task without an assignee with 400', () => {
      expect(() => service.createTask(newTask({ assigneeId: undefined }), mona)).toThrow(
        ValidationError,
      );
    });

    it.each([
      ['an empty title', { title: '' }],
      ['a title of only spaces', { title: '   ' }],
      ['no due date', { dueDate: undefined }],
      ['a due date in words', { dueDate: 'tomorrow' }],
      ['a due date as DD/MM/YYYY', { dueDate: '02/11/2026' }],
      ['no priority', { priority: undefined }],
      ['a priority that is not LOW/MEDIUM/HIGH', { priority: 'URGENT' }],
    ])('rejects a task with %s with 400', (_case, overrides) => {
      expect(() => service.createTask(newTask(overrides), mona)).toThrow(ValidationError);
      expect(taskRepository.findAll()).toEqual([]);
    });
  });

  describe('changeStatus', () => {
    let task;

    // A TO_DO task assigned to Karim, with the TASK_ASSIGNED event cleared
    beforeEach(() => {
      task = service.createTask(newTask(), mona);
      eventPublisher.events = [];
    });

    const expectUnchanged = () => {
      expect(taskRepository.findById(task.id).status).toBe(TaskStatus.TO_DO);
      expect(historyRepository.findAll()).toEqual([]);
      expect(eventPublisher.events).toEqual([]);
    };

    it('US1-2: assignee changes the status → new status saved and a history entry (old, new, who, when)', () => {
      const updated = service.changeStatus({
        taskId: task.id,
        status: TaskStatus.IN_PROGRESS,
        user: karim,
      });

      expect(updated).toEqual({ ...task, status: TaskStatus.IN_PROGRESS });
      expect(taskRepository.findById(task.id).status).toBe(TaskStatus.IN_PROGRESS);
      const [entry] = historyRepository.findAll();
      expect(entry).toEqual({
        id: expect.any(Number),
        taskId: task.id,
        oldStatus: TaskStatus.TO_DO,
        newStatus: TaskStatus.IN_PROGRESS,
        changedBy: karim.id,
        changedAt: expect.any(String),
      });
      expect(new Date(entry.changedAt).toISOString()).toBe(entry.changedAt);
    });

    it('US1-2: To Do → In Progress → Done logs one entry per change, in order', () => {
      service.changeStatus({ taskId: task.id, status: TaskStatus.IN_PROGRESS, user: karim });
      service.changeStatus({ taskId: task.id, status: TaskStatus.DONE, user: karim });

      const steps = historyRepository
        .findAll()
        .map(({ oldStatus, newStatus }) => [oldStatus, newStatus]);
      expect(steps).toEqual([
        [TaskStatus.TO_DO, TaskStatus.IN_PROGRESS],
        [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
      ]);
    });

    it('NFR Security: a manager who is not the assignee can change the status', () => {
      service.changeStatus({ taskId: task.id, status: TaskStatus.IN_PROGRESS, user: mona });

      expect(taskRepository.findById(task.id).status).toBe(TaskStatus.IN_PROGRESS);
      expect(historyRepository.findAll()[0].changedBy).toBe(mona.id);
    });

    it('US1-3: a member who is neither assignee nor manager → 403, status unchanged', () => {
      expect(() =>
        service.changeStatus({ taskId: task.id, status: TaskStatus.DONE, user: omar }),
      ).toThrow(ForbiddenError);
      expectUnchanged();
    });

    it('US1-3: a user outside the project → 403, status unchanged', () => {
      expect(() =>
        service.changeStatus({ taskId: task.id, status: TaskStatus.DONE, user: hany }),
      ).toThrow(ForbiddenError);
      expectUnchanged();
    });

    it('NFR Security: a non-allowed user gets 403 even when the status is also invalid', () => {
      expect(() =>
        service.changeStatus({ taskId: task.id, status: 'IN_REVIEW', user: omar }),
      ).toThrow(ForbiddenError);
    });

    it('rejects an unknown task with 404', () => {
      expect(() =>
        service.changeStatus({ taskId: 999, status: TaskStatus.DONE, user: mona }),
      ).toThrow(NotFoundError);
    });

    it.each([['IN_REVIEW'], ['done'], [undefined]])(
      'rejects the status %s with 400, status unchanged',
      (status) => {
        expect(() => service.changeStatus({ taskId: task.id, status, user: karim })).toThrow(
          ValidationError,
        );
        expectUnchanged();
      },
    );

    it('rejects changing to the status the task already has with 400, status unchanged', () => {
      expect(() =>
        service.changeStatus({ taskId: task.id, status: TaskStatus.TO_DO, user: karim }),
      ).toThrow(new ValidationError('Task is already TO_DO'));
      expectUnchanged();
    });

    it('publishes TASK_STATUS_CHANGED with the updated task, who and when', () => {
      const updated = service.changeStatus({
        taskId: task.id,
        status: TaskStatus.IN_PROGRESS,
        user: karim,
      });

      expect(eventPublisher.events).toEqual([
        {
          type: EventNames.TASK_STATUS_CHANGED,
          task: updated,
          actorId: karim.id,
          occurredAt: expect.any(String),
        },
      ]);
    });

    it('completing a task publishes TASK_STATUS_CHANGED and then TASK_COMPLETED', () => {
      const done = service.changeStatus({ taskId: task.id, status: TaskStatus.DONE, user: karim });

      expect(eventPublisher.events.map((event) => event.type)).toEqual([
        EventNames.TASK_STATUS_CHANGED,
        EventNames.TASK_COMPLETED,
      ]);
      expect(eventPublisher.events[1]).toMatchObject({ task: done, actorId: karim.id });
    });

    describe('with a dependencyService (FR6, turn 3)', () => {
      let checkedTaskIds;

      // Fake: every task is blocked; remembers which task ids it was asked about
      beforeEach(() => {
        checkedTaskIds = [];
        service = makeService({
          isBlocked: (taskId) => {
            checkedTaskIds.push(taskId);
            return true;
          },
        });
      });

      it.each([[TaskStatus.IN_PROGRESS], [TaskStatus.DONE]])(
        'a blocked task cannot move to %s → ConflictError, status unchanged',
        (status) => {
          expect(() => service.changeStatus({ taskId: task.id, status, user: karim })).toThrow(
            new ConflictError('Task is blocked'),
          );
          expect(checkedTaskIds).toEqual([task.id]);
          expectUnchanged();
        },
      );

      it('a blocked task can still be moved back to TO_DO (no blocked check needed)', () => {
        taskRepository.update(task.id, { status: TaskStatus.IN_PROGRESS }); // setup only

        const updated = service.changeStatus({
          taskId: task.id,
          status: TaskStatus.TO_DO,
          user: karim,
        });

        expect(updated.status).toBe(TaskStatus.TO_DO);
        expect(checkedTaskIds).toEqual([]);
      });

      it('a same-status request is rejected with 400 before isBlocked is asked', () => {
        taskRepository.update(task.id, { status: TaskStatus.IN_PROGRESS }); // setup only

        expect(() =>
          service.changeStatus({ taskId: task.id, status: TaskStatus.IN_PROGRESS, user: karim }),
        ).toThrow(new ValidationError('Task is already IN_PROGRESS'));
        expect(checkedTaskIds).toEqual([]);
        expect(taskRepository.findById(task.id).status).toBe(TaskStatus.IN_PROGRESS);
        expect(historyRepository.findAll()).toEqual([]);
        expect(eventPublisher.events).toEqual([]);
      });
    });
  });
});
