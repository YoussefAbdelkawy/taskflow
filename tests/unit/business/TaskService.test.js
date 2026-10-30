const TaskService = require('../../../src/business/services/TaskService');
const AuthorizationService = require('../../../src/business/services/AuthorizationService');
const InMemoryRepository = require('../../../src/data-access/repositories/InMemoryRepository');
const {
  InMemoryProjectRepository,
  InMemoryTaskRepository,
} = require('../helpers/inMemoryRepositories');
const { ForbiddenError, ValidationError } = require('../../../src/business/errors/AppError');
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

describe('TaskService', () => {
  let taskRepository;
  let eventPublisher;
  let service;

  beforeEach(() => {
    const projectRepository = new InMemoryProjectRepository();
    projectRepository.addMember({ projectId: PROJECT_ID, userId: mona.id, role: Role.MANAGER });
    projectRepository.addMember({ projectId: PROJECT_ID, userId: karim.id, role: Role.MEMBER });
    projectRepository.addMember({
      projectId: OTHER_PROJECT_ID,
      userId: hany.id,
      role: Role.MEMBER,
    });
    taskRepository = new InMemoryTaskRepositoryWithLists();
    eventPublisher = new RecordingPublisher();
    service = new TaskService({
      taskRepository,
      historyRepository: new InMemoryRepository(),
      authorizationService: new AuthorizationService({ projectRepository }),
      eventPublisher,
    });
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
});
