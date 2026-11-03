const BaseRepository = require('./BaseRepository');

const toPrerequisite = (row) => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  status: row.status,
});

const toLink = (row) => ({
  taskId: row.task_id,
  dependsOnId: row.depends_on_id,
});

/**
 * The task_dependencies link table (FR6).
 * Rules such as "no cycles" live in DependencyService, never here.
 */
class TaskDependencyRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  /**
   * @param {{ taskId: number, dependsOnId: number }} link
   * @returns {{ taskId: number, dependsOnId: number }}
   * requires: both tasks exist (the foreign keys enforce this)
   * effects: saves one dependency edge
   * modifies: task_dependencies
   */
  add({ taskId, dependsOnId }) {
    this.db
      .prepare('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)')
      .run(taskId, dependsOnId);
    return { taskId, dependsOnId };
  }

  /**
   * @param {{ taskId: number, dependsOnId: number }} link
   * @returns {boolean} true if the edge existed
   * effects: removes one dependency edge
   * modifies: task_dependencies
   */
  remove({ taskId, dependsOnId }) {
    return (
      this.db
        .prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
        .run(taskId, dependsOnId).changes > 0
    );
  }

  /**
   * @param {number} taskId
   * @returns {{ id: number, projectId: number, title: string, status: string }[]}
   * effects: returns the tasks that `taskId` depends on, oldest first
   * modifies: nothing
   */
  findPrerequisites(taskId) {
    return this.db
      .prepare(
        `SELECT t.id, t.project_id, t.title, t.status
         FROM tasks t
         JOIN task_dependencies d ON d.depends_on_id = t.id
         WHERE d.task_id = ?
         ORDER BY t.id`,
      )
      .all(taskId)
      .map(toPrerequisite);
  }

  /**
   * @param {number} projectId
   * @returns {{ taskId: number, dependsOnId: number }[]}
   * effects: returns every dependency edge whose task belongs to the project
   * modifies: nothing
   */
  findAllInProject(projectId) {
    return this.db
      .prepare(
        `SELECT d.task_id, d.depends_on_id
         FROM task_dependencies d
         JOIN tasks t ON t.id = d.task_id
         WHERE t.project_id = ?
         ORDER BY d.task_id, d.depends_on_id`,
      )
      .all(projectId)
      .map(toLink);
  }

  /**
   * @param {() => any} work
   * @returns {any} whatever `work` returns
   * requires: work runs synchronously and does not start its own transaction
   * effects: runs work inside BEGIN/COMMIT; rolls back and rethrows on error
   * modifies: the database transaction state
   */
  runInTransaction(work) {
    this.db.exec('BEGIN');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

module.exports = TaskDependencyRepository;
