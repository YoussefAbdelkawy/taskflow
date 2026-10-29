/** A message for a user about a task. type is a NotificationType value. */
class Notification {
  constructor({ id, userId, taskId, type, message, isRead, createdAt }) {
    this.id = id;
    this.userId = userId;
    this.taskId = taskId;
    this.type = type;
    this.message = message;
    this.isRead = isRead;
    this.createdAt = createdAt;
  }
}

module.exports = Notification;
