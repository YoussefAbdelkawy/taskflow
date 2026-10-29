const TaskObserver = require('../events/TaskObserver');
const EventNames = require('../events/eventNames');
const { strategyFor } = require('../rules/recurrence/strategyFor');
const { formatDate } = require('../rules/recurrence/utcDate');
const { ForbiddenError, NotFoundError } = require('../errors/AppError');
const { Role, TaskStatus } = require('../../domain/enums');

// What node:sqlite throws when a UNIQUE constraint fails (checked in the terminal):
// errcode 2067 = SQLITE_CONSTRAINT_UNIQUE, message "UNIQUE constraint failed: ...".
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const isDuplicatePeriod = (error) => error?.errcode === SQLITE_CONSTRAINT_UNIQUE;

const stateOf = (taskId, rule) =>
  rule
    ? { taskId, frequency: rule.frequency, isActive: rule.isActive }
    : { taskId, frequency: null, isActive: false };

/**
 * FR2: recurring tasks. A manager marks a task as daily, weekly or monthly. When an
 * instance is completed (TASK_COMPLETED event) or its due date passes (runDue, called by
 * the Scheduler), the next instance is created, never twice for the same period.
 */
class RecurrenceService extends TaskObserver {
  constructor({ recurrenceRuleRepository, taskRepository, projectRepository }) {
    super();
    this.recurrenceRuleRepository = recurrenceRuleRepository;
    this.taskRepository = taskRepository;
    this.projectRepository = projectRepository;
  }

  /**
   * @param {{ taskId: number, frequency: string, user: { id: number } }} input
   * @returns {{ taskId: number, frequency: string, isActive: boolean }}
   * requires: user is the logged-in user
   * effects: makes the task repeat with this frequency (updating its rule if it has one);
   *          throws NotFoundError (no task), ForbiddenError (not a manager of the task's
   *          project) or ValidationError (unknown frequency)
   * modifies: recurrence_rules, and the task's recurrenceId when it gets a new rule
   */
  setRecurring({ taskId, frequency, user }) {
    const task = this.findManagedTask({ taskId, user });
    strategyFor(frequency); // throws ValidationError('Unknown frequency')

    if (task.recurrenceId) {
      const rule = this.recurrenceRuleRepository.update(task.recurrenceId, {
        frequency,
        isActive: true,
      });
      return stateOf(taskId, rule);
    }

    const rule = this.recurrenceRuleRepository.create({
      frequency,
      isActive: true,
      lastGeneratedPeriod: null,
    });
    this.taskRepository.update(taskId, { recurrenceId: rule.id });
    return stateOf(taskId, rule);
  }

  /**
   * @param {{ taskId: number, user: { id: number } }} input
   * @returns {{ taskId: number, frequency: string, isActive: false }}
   * requires: user is the logged-in user
   * effects: stops new instances; the current instance stays unchanged (US2-3); throws
   *          NotFoundError (no task, or 'Task is not recurring') or ForbiddenError
   * modifies: the task's recurrence rule (isActive)
   */
  turnOff({ taskId, user }) {
    const task = this.findManagedTask({ taskId, user });
    if (!task.recurrenceId) throw new NotFoundError('Task is not recurring');

    const rule = this.recurrenceRuleRepository.update(task.recurrenceId, { isActive: false });
    return stateOf(taskId, rule);
  }

  /**
   * @param {{ taskId: number, user: { id: number } }} input
   * @returns {{ taskId: number, frequency: string | null, isActive: boolean }}
   * requires: user is the logged-in user
   * effects: returns the task's recurrence; throws NotFoundError (no task) or
   *          ForbiddenError (user is not in the task's project)
   * modifies: nothing
   */
  getRecurrence({ taskId, user }) {
    const task = this.findTask(taskId);
    if (!this.roleIn(task, user)) throw new ForbiddenError('You are not a member of this project');

    const rule = task.recurrenceId
      ? this.recurrenceRuleRepository.findById(task.recurrenceId)
      : null;
    return stateOf(taskId, rule);
  }

  /**
   * @param {object} task - the instance to continue from
   * @returns {object | null} the new instance, or null if nothing was created
   * requires: task has recurrenceId, dueDate and the fields to copy
   * effects: creates the next instance (same project, assignee, title, description and
   *          priority; status TO_DO; due date moved forward) unless the rule is missing or
   *          off, or that period already exists. Safe to call many times (NFR).
   * modifies: tasks, and the rule's lastGeneratedPeriod
   */
  generateNext(task) {
    const rule = this.recurrenceRuleRepository.findById(task.recurrenceId);
    if (!rule || !rule.isActive) return null;

    const nextDue = strategyFor(rule.frequency).nextDueDate(task.dueDate);
    if (this.isAlreadyGenerated(rule, nextDue)) return null;

    const created = this.createInstance(task, nextDue);
    if (!created) return null;

    this.recurrenceRuleRepository.update(rule.id, { lastGeneratedPeriod: nextDue });
    return created;
  }

  /**
   * @param {{ type: string, task: object }} event
   * effects: on TASK_COMPLETED for a recurring task, creates the next instance;
   *          ignores every other event
   * modifies: see generateNext
   */
  onTaskEvent(event) {
    if (event.type !== EventNames.TASK_COMPLETED || !event.task?.recurrenceId) return;
    this.generateNext(event.task);
  }

  /**
   * @param {Date} now
   * @returns {number} how many instances were created
   * effects: for each active rule whose latest instance is not DONE and was due before
   *          today (UTC), creates the next instance. Running it again creates nothing new.
   * modifies: see generateNext
   */
  runDue(now) {
    const today = formatDate(now);

    // Declarative: the latest instance of every active rule, kept if it is overdue and open
    const overdue = this.recurrenceRuleRepository
      .findActive()
      .map((rule) => this.taskRepository.findLatestByRecurrence(rule.id))
      .filter((instance) => instance && instance.status !== TaskStatus.DONE)
      .filter((instance) => instance.dueDate < today);

    // Imperative: the scheduler loop, one instance at a time, counting what was created
    let createdCount = 0;
    for (const instance of overdue) {
      if (this.generateNext(instance)) createdCount += 1;
    }
    return createdCount;
  }

  findTask(taskId) {
    const task = this.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);
    return task;
  }

  roleIn(task, user) {
    return this.projectRepository.findMemberRole({ projectId: task.projectId, userId: user.id });
  }

  findManagedTask({ taskId, user }) {
    const task = this.findTask(taskId);
    if (this.roleIn(task, user) !== Role.MANAGER) {
      throw new ForbiddenError('Only a project manager can change recurrence');
    }
    return task;
  }

  isAlreadyGenerated(rule, nextDue) {
    if (rule.lastGeneratedPeriod === nextDue) return true;
    const existing = this.taskRepository.findByRecurrenceAndDueDate({
      recurrenceId: rule.id,
      dueDate: nextDue,
    });
    return existing !== null;
  }

  createInstance(task, nextDue) {
    try {
      return this.taskRepository.create({
        projectId: task.projectId,
        assigneeId: task.assigneeId,
        recurrenceId: task.recurrenceId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: TaskStatus.TO_DO,
        dueDate: nextDue,
      });
    } catch (error) {
      if (isDuplicatePeriod(error)) return null; // another run created it first
      throw error;
    }
  }
}

module.exports = RecurrenceService;
