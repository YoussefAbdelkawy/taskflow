const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../errors/AppError');
const { TaskStatus, Priority } = require('../../domain/enums');
const EventNames = require('../events/eventNames');

// Due dates are stored as text YYYY-MM-DD (team contract)
const DUE_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
// FR6: a blocked task cannot move to these statuses (moving back to TO_DO is always allowed)
const STATUSES_NEEDING_UNBLOCKED = Object.freeze([TaskStatus.IN_PROGRESS, TaskStatus.DONE]);

const isPriority = (value) => Object.values(Priority).includes(value);
const isTaskStatus = (value) => Object.values(TaskStatus).includes(value);

/**
 * @param {{ title: string, dueDate: string, priority: string }} fields
 * effects: throws ValidationError for the first field that is missing or invalid
 */
function checkTaskFields({ title, dueDate, priority }) {
  // Imperative: one guard clause per field, stop at the first problem
  if (typeof title !== 'string' || !title.trim()) throw new ValidationError('Title is required');
  if (!DUE_DATE_FORMAT.test(dueDate)) throw new ValidationError('Due date must be YYYY-MM-DD');
  // Declarative: "is it one of the Priority values?" instead of three comparisons
  if (!isPriority(priority)) throw new ValidationError('Priority must be LOW, MEDIUM or HIGH');
}

// The event shape every observer receives (team contract)
const taskEvent = (type, { task, actorId }) => ({
  type,
  task,
  actorId,
  occurredAt: new Date().toISOString(),
});

/** FR1: managers create and assign tasks; assignees move them through the statuses. */
class TaskService {
  /**
   * @param {object} deps
   * @param {object} deps.taskRepository
   * @param {object} deps.historyRepository - TaskStatusHistoryRepository
   * @param {import('./AuthorizationService')} deps.authorizationService
   * @param {import('../events/EventPublisher')} deps.eventPublisher
   * @param {object} [deps.dependencyService] - optional; FR6 (Ali) adds it in turn 3
   */
  constructor({
    taskRepository,
    historyRepository,
    authorizationService,
    eventPublisher,
    dependencyService = null,
  }) {
    this.taskRepository = taskRepository;
    this.historyRepository = historyRepository;
    this.authorizationService = authorizationService;
    this.eventPublisher = eventPublisher;
    this.dependencyService = dependencyService;
  }

  /**
   * @param {{ projectId: number, title: string, description?: string, assigneeId: number,
   *           dueDate: string, priority: string }} input
   * @param {{ id: number }} user - the logged-in user (req.user)
   * @returns {object} the saved task
   * requires: user is logged in
   * effects: saves the task as TO_DO, publishes TASK_ASSIGNED and returns the task;
   *          throws ForbiddenError if user is not a manager of the project (checked first),
   *          ValidationError if the assignee is missing or not a project member, or if
   *          title, dueDate (YYYY-MM-DD) or priority is missing or invalid
   * modifies: the tasks table; the observers of the EventPublisher
   */
  createTask({ projectId, title, description, assigneeId, dueDate, priority }, user) {
    // Imperative: permission first (NFR Security), then the input, then save
    if (!this.authorizationService.isManager(user.id, projectId)) {
      throw new ForbiddenError('Only a project manager can create tasks');
    }
    if (!assigneeId) throw new ValidationError('Assignee is required');
    if (!this.authorizationService.isMember(assigneeId, projectId)) {
      throw new ValidationError('The assignee must be a member of the project');
    }
    checkTaskFields({ title, dueDate, priority });

    // Only these fields are saved, so a request cannot set status or recurrence itself
    const task = this.taskRepository.create({
      projectId,
      title: title.trim(),
      description: description ?? '',
      assigneeId,
      dueDate,
      priority,
      status: TaskStatus.TO_DO,
    });
    this.eventPublisher.publish(taskEvent(EventNames.TASK_ASSIGNED, { task, actorId: user.id }));
    return task;
  }

  /**
   * @param {{ taskId: number, status: string, user: { id: number } }} change
   * @returns {object} the updated task
   * requires: user is logged in
   * effects: saves the new status, logs a history entry (old, new, who, when), publishes
   *          TASK_STATUS_CHANGED, and TASK_COMPLETED when the new status is DONE.
   *          Throws, in this order: NotFoundError if the task does not exist;
   *          ForbiddenError if user is neither the assignee nor a manager of its project;
   *          ValidationError if status is not a TaskStatus or is the task's current status;
   *          ConflictError('Task is blocked') if a dependencyService says the task is blocked
   *          and the new status is IN_PROGRESS or DONE
   * modifies: the tasks and task_status_history tables; the observers of the EventPublisher
   */
  changeStatus({ taskId, status, user }) {
    // Imperative: guard clauses in a fixed order (404, 403, 400, 409), then save
    const task = this.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);
    if (!this.canChangeStatus(task, user)) {
      throw new ForbiddenError('Only the assignee or a project manager can change the status');
    }
    if (!isTaskStatus(status)) {
      throw new ValidationError('Status must be TO_DO, IN_PROGRESS or DONE');
    }
    if (status === task.status) throw new ValidationError(`Task is already ${status}`);
    if (this.isBlockedFrom(task, status)) throw new ConflictError('Task is blocked');

    const updated = this.taskRepository.update(task.id, { status });
    this.historyRepository.create({
      taskId: task.id,
      oldStatus: task.status,
      newStatus: status,
      changedBy: user.id,
      changedAt: new Date().toISOString(),
    });
    this.publishStatusEvents(updated, user.id);
    return updated;
  }

  // NFR Security: only the assignee or a manager of the task's project
  canChangeStatus(task, user) {
    return (
      task.assigneeId === user.id || this.authorizationService.isManager(user.id, task.projectId)
    );
  }

  // Asks FR6 only when it is wired in and only for a move that starts or finishes work
  isBlockedFrom(task, status) {
    if (!this.dependencyService) return false;
    if (!STATUSES_NEEDING_UNBLOCKED.includes(status)) return false;
    return this.dependencyService.isBlocked(task.id);
  }

  publishStatusEvents(task, actorId) {
    this.eventPublisher.publish(taskEvent(EventNames.TASK_STATUS_CHANGED, { task, actorId }));
    // FR2 (recurrence) listens for this one
    if (task.status === TaskStatus.DONE) {
      this.eventPublisher.publish(taskEvent(EventNames.TASK_COMPLETED, { task, actorId }));
    }
  }
}

module.exports = TaskService;
