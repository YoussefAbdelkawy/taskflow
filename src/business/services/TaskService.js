const { ValidationError, ForbiddenError } = require('../errors/AppError');
const { TaskStatus, Priority } = require('../../domain/enums');
const EventNames = require('../events/eventNames');

// Due dates are stored as text YYYY-MM-DD (team contract)
const DUE_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const isPriority = (value) => Object.values(Priority).includes(value);

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
}

module.exports = TaskService;
