const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../errors/AppError');
const { TaskStatus } = require('../../domain/enums');

/**
 * FR6: managers add "task B depends on task A" edges.
 * A task is blocked while any prerequisite is not DONE.
 */
class DependencyService {
  /**
   * @param {object} deps
   * @param {object} deps.taskRepository
   * @param {object} deps.taskDependencyRepository
   * @param {import('./AuthorizationService')} deps.authorizationService
   */
  constructor({ taskRepository, taskDependencyRepository, authorizationService }) {
    this.taskRepository = taskRepository;
    this.taskDependencyRepository = taskDependencyRepository;
    this.authorizationService = authorizationService;
  }

  /**
   * @param {{ taskId: number, dependsOnId: number, user: { id: number } }} input
   * @returns {{ taskId: number, dependsOnId: number }} the saved edge
   * requires: user is a manager of the task's project
   * effects: saves the edge; throws NotFoundError for a missing task,
   * ForbiddenError for a non-manager, ValidationError for a self-link or
   * tasks in different projects, ConflictError for a duplicate or a cycle
   * modifies: task_dependencies
   */
  addDependency({ taskId, dependsOnId, user }) {
    // Imperative: guard clauses first, then the write (Lab 2: fail fast)
    const task = this.#findTask(taskId);
    if (!this.authorizationService.isManager(user.id, task.projectId)) {
      throw new ForbiddenError('Only a project manager can add dependencies');
    }
    if (taskId === dependsOnId) {
      throw new ValidationError('A task cannot depend on itself');
    }
    const prerequisite = this.#findTask(dependsOnId);
    if (prerequisite.projectId !== task.projectId) {
      throw new ValidationError('Both tasks must belong to the same project');
    }
    const alreadyLinked = this.taskDependencyRepository
      .findPrerequisites(taskId)
      .some((existing) => existing.id === dependsOnId);
    if (alreadyLinked) {
      throw new ConflictError('Dependency already exists');
    }
    return this.taskDependencyRepository.runInTransaction(() => {
      // The cycle check and the insert run as one unit (NFR Data integrity).
      if (this.#wouldCreateCycle(taskId, dependsOnId)) {
        throw new ConflictError('Circular dependency');
      }
      return this.taskDependencyRepository.add({ taskId, dependsOnId });
    });
  }

  /**
   * @param {number} taskId
   * @returns {boolean} true when at least one prerequisite is not DONE
   * requires: nothing (a task with no prerequisites is never blocked)
   * effects: reads the task's prerequisites
   * modifies: nothing
   */
  isBlocked(taskId) {
    // Declarative: "is there at least one prerequisite that is not DONE?"
    return this.taskDependencyRepository
      .findPrerequisites(taskId)
      .some((task) => task.status !== TaskStatus.DONE);
  }

  /**
   * @param {number} taskId
   * @param {{ id: number }} user
   * @returns {{ prerequisites: object[], isBlocked: boolean }}
   * requires: user is logged in
   * effects: returns the prerequisites and the Blocked flag; throws NotFoundError
   * for a missing task and ForbiddenError for a non-member
   * modifies: nothing
   */
  getDependencies(taskId, user) {
    const task = this.#findTask(taskId);
    if (!this.authorizationService.isMember(user.id, task.projectId)) {
      throw new ForbiddenError('Only project members can see task dependencies');
    }
    const prerequisites = this.taskDependencyRepository.findPrerequisites(taskId);
    return {
      prerequisites,
      isBlocked: prerequisites.some((prerequisite) => prerequisite.status !== TaskStatus.DONE),
    };
  }

  #findTask(taskId) {
    const task = this.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);
    return task;
  }

  // Walks from the would-be prerequisite back through its own prerequisites.
  // If that walk reaches taskId, adding the edge would close a cycle.
  #wouldCreateCycle(taskId, dependsOnId) {
    const visited = new Set();
    const pending = [dependsOnId];
    while (pending.length > 0) {
      const currentId = pending.pop();
      if (currentId === taskId) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const prerequisites = this.taskDependencyRepository.findPrerequisites(currentId);
      pending.push(...prerequisites.map((task) => task.id));
    }
    return false;
  }
}

module.exports = DependencyService;
