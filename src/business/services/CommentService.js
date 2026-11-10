const { ForbiddenError, NotFoundError, ValidationError } = require('../errors/AppError');

class CommentService {
  constructor({ commentRepository, taskRepository, authorizationService }) {
    this.commentRepository = commentRepository;
    this.taskRepository = taskRepository;
    this.authorizationService = authorizationService;
  }

  /**
   * @param {{ taskId: number, content: string, user: { id: number } }} input
   * @returns {object} the saved comment
   * requires: user is logged in, comment content is non-empty after trimming, and user is a project member
   * effects: saves a comment with an ISO timestamp or throws an application error
   * modifies: comments
   */
  addComment({ taskId, content, user }) {
    // Imperative: validate and authorize before writing a comment.
    if (typeof content !== 'string' || !content.trim()) {
      throw new ValidationError('Comment cannot be empty');
    }
    const task = this.#findTask(taskId);
    this.#requireMember(user.id, task.projectId);

    return this.commentRepository.create({
      taskId,
      userId: user.id,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * @param {number} taskId
   * @param {{ id: number }} user
   * @returns {object[]} comments in oldest-first order
   * requires: user is logged in and belongs to the task's project
   * effects: returns comments with author names or throws NotFoundError / ForbiddenError
   * modifies: nothing
   */
  listComments(taskId, user) {
    const task = this.#findTask(taskId);
    this.#requireMember(user.id, task.projectId);
    // Declarative: the repository query returns the task's comments in creation order.
    return this.commentRepository.findByTask(taskId);
  }

  #findTask(taskId) {
    const task = this.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);
    return task;
  }

  #requireMember(userId, projectId) {
    if (!this.authorizationService.isMember(userId, projectId)) {
      throw new ForbiddenError('Only project members can access task comments');
    }
  }
}

module.exports = CommentService;
