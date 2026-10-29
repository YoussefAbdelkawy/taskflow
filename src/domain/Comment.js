/** A comment a user wrote on a task. createdAt is an ISO timestamp. */
class Comment {
  constructor({ id, taskId, userId, content, createdAt }) {
    this.id = id;
    this.taskId = taskId;
    this.userId = userId;
    this.content = content;
    this.createdAt = createdAt;
  }
}

module.exports = Comment;
