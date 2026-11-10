const BaseRepository = require('./BaseRepository');
const { insertRow } = require('./sqlHelpers');

const TABLE = 'comments';

const toComment = (row) =>
  row
    ? {
        id: row.id,
        taskId: row.task_id,
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
        name: row.name,
      }
    : null;

/** Comments in SQLite. Reads include the author's display name. */
class CommentRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  create(comment) {
    const id = insertRow(this.db, {
      table: TABLE,
      row: {
        task_id: comment.taskId,
        user_id: comment.userId,
        content: comment.content,
        created_at: comment.createdAt,
      },
    });
    return this.#findById(id);
  }

  /** @param {number} taskId @returns {object[]} comments oldest first, with author names */
  findByTask(taskId) {
    return this.db
      .prepare(
        `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, u.name
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ?
         ORDER BY c.created_at, c.id`,
      )
      .all(taskId)
      .map(toComment);
  }

  #findById(id) {
    return toComment(
      this.db
        .prepare(
          `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, u.name
           FROM comments c
           JOIN users u ON u.id = c.user_id
           WHERE c.id = ?`,
        )
        .get(id),
    );
  }
}

module.exports = CommentRepository;
