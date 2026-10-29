const { TaskStatus } = require('./enums');

/** A piece of work in a project. dueDate is text YYYY-MM-DD. */
class Task {
  constructor({
    id,
    projectId,
    assigneeId,
    recurrenceId,
    title,
    description,
    status,
    priority,
    dueDate,
  }) {
    this.id = id;
    this.projectId = projectId;
    this.assigneeId = assigneeId;
    this.recurrenceId = recurrenceId;
    this.title = title;
    this.description = description;
    this.status = status;
    this.priority = priority;
    this.dueDate = dueDate;
  }

  /** @returns {boolean} true only when the status is DONE */
  isDone() {
    return this.status === TaskStatus.DONE;
  }
}

module.exports = Task;
