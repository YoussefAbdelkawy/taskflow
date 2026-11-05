const DependencyService = require('../../../src/business/services/DependencyService');
const AuthorizationService = require('../../../src/business/services/AuthorizationService');
const {
  InMemoryProjectRepository,
  InMemoryTaskRepository,
} = require('../helpers/inMemoryRepositories');
const { Role, TaskStatus } = require('../../../src/domain/enums');
const {
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
} = require('../../../src/business/errors/AppError');

class InMemoryDependencyRepository {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
    this.links = [];
  }

  add({ taskId, dependsOnId }) {
    this.links.push({ taskId, dependsOnId });
    return { taskId, dependsOnId };
  }

  remove({ taskId, dependsOnId }) {
    const index = this.links.findIndex(
      (link) => link.taskId === taskId && link.dependsOnId === dependsOnId,
    );
    if (index === -1) return false;
    this.links.splice(index, 1);
    return true;
  }

  findPrerequisites(taskId) {
    return this.links
      .filter((link) => link.taskId === taskId)
      .map((link) => {
        const task = this.taskRepository.findById(link.dependsOnId);
        // Mimic the real SQL query which only selects these 4 fields
        return {
          id: task.id,
          projectId: task.projectId,
          title: task.title,
          status: task.status,
        };
      });
  }

  findAllInProject(projectId) {
    return this.links.filter((link) => {
      const task = this.taskRepository.findById(link.taskId);
      return task?.projectId === projectId;
    });
  }

  runInTransaction(work) {
    return work();
  }
}

describe('DependencyService (FR6)', () => {
  const PROJECT_ID = 1;
  const OTHER_PROJECT_ID = 2;
  const mona = { id: 10 };
  const karim = { id: 11 };
  const hany = { id: 12 };

  let projectRepository;
  let taskRepository;
  let dependencyRepository;
  let service;
  let a;
  let b;
  let c;

  const createTask = (overrides = {}) =>
    taskRepository.create({
      projectId: PROJECT_ID,
      assigneeId: karim.id,
      recurrenceId: null,
      title: 'Task',
      description: '',
      status: TaskStatus.TO_DO,
      priority: 'MEDIUM',
      dueDate: '2026-11-02',
      ...overrides,
    });

  beforeEach(() => {
    projectRepository = new InMemoryProjectRepository();
    projectRepository.addMember({
      projectId: PROJECT_ID,
      userId: mona.id,
      role: Role.MANAGER,
    });
    projectRepository.addMember({
      projectId: PROJECT_ID,
      userId: karim.id,
      role: Role.MEMBER,
    });
    projectRepository.addMember({
      projectId: OTHER_PROJECT_ID,
      userId: hany.id,
      role: Role.MEMBER,
    });

    taskRepository = new InMemoryTaskRepository();
    dependencyRepository = new InMemoryDependencyRepository(taskRepository);
    service = new DependencyService({
      taskRepository,
      taskDependencyRepository: dependencyRepository,
      authorizationService: new AuthorizationService({ projectRepository }),
    });

    a = createTask({ title: 'A' });
    b = createTask({ title: 'B' });
    c = createTask({ title: 'C' });
  });

  describe('addDependency and isBlocked', () => {
    it('US6-1: B depends on A and A is not Done → B is blocked', () => {
      service.addDependency({
        taskId: b.id,
        dependsOnId: a.id,
        user: mona,
      });

      expect(service.isBlocked(b.id)).toBe(true);
      expect(service.isBlocked(a.id)).toBe(false);
    });

    it('US6-2: A marked Done → B is no longer blocked', () => {
      service.addDependency({
        taskId: b.id,
        dependsOnId: a.id,
        user: mona,
      });
      taskRepository.update(a.id, { status: TaskStatus.DONE });

      expect(service.isBlocked(b.id)).toBe(false);
    });

    it('US6-3: rejects a direct cycle and saves nothing', () => {
      service.addDependency({
        taskId: b.id,
        dependsOnId: a.id,
        user: mona,
      });

      expect(() =>
        service.addDependency({
          taskId: a.id,
          dependsOnId: b.id,
          user: mona,
        }),
      ).toThrow(new ConflictError('Circular dependency'));
      expect(dependencyRepository.links).toEqual([{ taskId: b.id, dependsOnId: a.id }]);
    });

    it('rejects a longer cycle A → B → C → A', () => {
      service.addDependency({
        taskId: a.id,
        dependsOnId: b.id,
        user: mona,
      });
      service.addDependency({
        taskId: b.id,
        dependsOnId: c.id,
        user: mona,
      });

      expect(() =>
        service.addDependency({
          taskId: c.id,
          dependsOnId: a.id,
          user: mona,
        }),
      ).toThrow(new ConflictError('Circular dependency'));
      expect(dependencyRepository.links).toHaveLength(2);
    });

    it('NFR Security: only a manager may add a dependency', () => {
      expect(() =>
        service.addDependency({
          taskId: b.id,
          dependsOnId: a.id,
          user: karim,
        }),
      ).toThrow(ForbiddenError);
      expect(dependencyRepository.links).toEqual([]);
    });

    it('rejects a self-dependency', () => {
      expect(() =>
        service.addDependency({
          taskId: a.id,
          dependsOnId: a.id,
          user: mona,
        }),
      ).toThrow(new ValidationError('A task cannot depend on itself'));
    });

    it('rejects tasks from different projects', () => {
      const otherProjectTask = createTask({
        projectId: OTHER_PROJECT_ID,
        title: 'Other',
      });

      expect(() =>
        service.addDependency({
          taskId: a.id,
          dependsOnId: otherProjectTask.id,
          user: mona,
        }),
      ).toThrow(new ValidationError('Both tasks must belong to the same project'));
    });

    it('rejects a duplicate dependency', () => {
      service.addDependency({
        taskId: b.id,
        dependsOnId: a.id,
        user: mona,
      });

      expect(() =>
        service.addDependency({
          taskId: b.id,
          dependsOnId: a.id,
          user: mona,
        }),
      ).toThrow(new ConflictError('Dependency already exists'));
    });

    it('returns 404 when the task does not exist', () => {
      expect(() =>
        service.addDependency({
          taskId: 999,
          dependsOnId: a.id,
          user: mona,
        }),
      ).toThrow(NotFoundError);
    });
  });

  describe('getDependencies', () => {
    it('returns the prerequisites and the blocked flag for a member', () => {
      service.addDependency({
        taskId: b.id,
        dependsOnId: a.id,
        user: mona,
      });

      expect(service.getDependencies(b.id, karim)).toEqual({
        prerequisites: [
          {
            id: a.id,
            projectId: PROJECT_ID,
            title: 'A',
            status: TaskStatus.TO_DO,
          },
        ],
        isBlocked: true,
      });
    });

    it('NFR Security: a non-member cannot see the dependencies', () => {
      expect(() => service.getDependencies(b.id, hany)).toThrow(ForbiddenError);
    });
  });
});
