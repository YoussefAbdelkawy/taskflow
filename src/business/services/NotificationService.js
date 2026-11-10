const TaskObserver = require('../events/TaskObserver');
const EventNames = require('../events/eventNames');
const { TaskStatus, Role, NotificationType } = require('../../domain/enums');
const { ForbiddenError, NotFoundError } = require('../errors/AppError');

class NotificationService extends TaskObserver {
  constructor({ notificationRepository, taskRepository, projectRepository }) {
    super();
    this.notificationRepository = notificationRepository;
    this.taskRepository = taskRepository;
    this.projectRepository = projectRepository;
  }

  /**
   * requires: event follows the shared task-event contract
   * effects: immediately notifies the assignee when a task is assigned
   * modifies: notifications
   */
  onTaskEvent(event) {
    if (event.type !== EventNames.TASK_ASSIGNED) return;
    const { task } = event;
    if (!task.assigneeId) return;
    const project = this.projectRepository.findById(task.projectId);
    this.#notifyOnce({
      userId: task.assigneeId,
      task,
      type: NotificationType.ASSIGNED,
      message: `Assigned: ${task.title} in ${project.name}; due ${task.dueDate}; priority ${task.priority}.`,
      createdAt: event.occurredAt,
    });
  }

  /**
   * requires: now is a Date; due dates are UTC calendar dates
   * effects: sends one reminder for each open task due today or tomorrow, and one
   *          overdue alert to its assignee and project managers for earlier dates
   * modifies: notifications
   */
  sendReminders(now) {
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dueTasks = this.taskRepository.findOpenDueBefore(tomorrow);
    // Imperative: decide which alert each open task needs, then deliver it once.
    for (const task of dueTasks) {
      if (task.status === TaskStatus.DONE) continue;
      if (task.dueDate < today) {
        this.#sendOverdue(task, now.toISOString());
      } else {
        this.#sendDueSoon(task, now.toISOString());
      }
    }
  }

  /**
   * requires: user is logged in
   * effects: returns this user's notifications, newest first
   * modifies: nothing
   */
  listMine(user) {
    return this.notificationRepository.findByUser(user.id);
  }

  /**
   * requires: user is logged in
   * effects: marks a notification as read; rejects another user's notification
   * modifies: the owned notification's is_read flag
   */
  markRead({ id, user }) {
    const notification = this.notificationRepository.findById(id);
    if (!notification) throw new NotFoundError(`Notification ${id} not found`);
    if (notification.userId !== user.id) {
      throw new ForbiddenError('Only the owner can mark a notification as read');
    }
    return this.notificationRepository.markRead(id);
  }

  /**
   * requires: user is logged in
   * effects: returns the number of unread notifications for this user
   * modifies: nothing
   */
  unreadCount(user) {
    // Declarative: count only unread notifications belonging to this user.
    return this.notificationRepository.findByUser(user.id).filter(({ isRead }) => !isRead).length;
  }

  #sendDueSoon(task, createdAt) {
    if (!task.assigneeId) return;
    this.#notifyOnce({
      userId: task.assigneeId,
      task,
      type: NotificationType.DUE_SOON,
      message: `Due soon: ${task.title} is due ${task.dueDate}.`,
      createdAt,
    });
  }

  #sendOverdue(task, createdAt) {
    const managers = this.projectRepository
      .findMembers(task.projectId)
      .filter(({ role }) => role === Role.MANAGER)
      .map(({ userId }) => userId);
    const recipients = new Set([task.assigneeId, ...managers]);
    recipients.delete(null);
    // Declarative: notify each distinct recipient once, even if a manager is the assignee.
    for (const userId of recipients) {
      this.#notifyOnce({
        userId,
        task,
        type: NotificationType.OVERDUE,
        message: `Overdue: ${task.title} was due ${task.dueDate}.`,
        createdAt,
      });
    }
  }

  #notifyOnce({ userId, task, type, message, createdAt }) {
    if (this.notificationRepository.exists({ userId, taskId: task.id, type })) return;
    this.notificationRepository.create({ userId, taskId: task.id, type, message, createdAt });
  }
}

module.exports = NotificationService;
