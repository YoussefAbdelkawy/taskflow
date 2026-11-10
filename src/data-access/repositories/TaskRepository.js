const BaseRepository = require('./BaseRepository');
const { toRow, insertRow, updateRow, deleteRow } = require('./sqlHelpers');

const TABLE = 'tasks';
const COLUMNS = Object.freeze({
  projectId: 'project_id',
  assigneeId: 'assignee_id',
  recurrenceId: 'recurrence_id',
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  dueDate: 'due_date',
});

const toTask = (row) =>
  row
    ? {
        id: row.id,
        projectId: row.project_id,
        assigneeId: row.assignee_id,
        recurrenceId: row.recurrence_id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        dueDate: row.due_date,
      }
    : null;

/** Tasks in SQLite. (recurrence_id, due_date) is UNIQUE, so a period can exist only once. */
class TaskRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  findById(id) {
    return toTask(this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  }

  findAll() {
    return this.db.prepare('SELECT * FROM tasks ORDER BY id').all().map(toTask);
  }

  create(data) {
    return this.findById(insertRow(this.db, { table: TABLE, row: toRow(data, COLUMNS) }));
  }

  update(id, changes) {
    const found = updateRow(this.db, { table: TABLE, id, row: toRow(changes, COLUMNS) });
    return found ? this.findById(id) : null;
  }

  delete(id) {
    return deleteRow(this.db, { table: TABLE, id });
  }

  /** @returns {object[]} the tasks of one project */
  findByProject(projectId) {
    return this.db
      .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY due_date, id')
      .all(projectId)
      .map(toTask);
  }

  /** @returns {object[]} the tasks assigned to one user */
  findByAssignee(userId) {
    return this.db
      .prepare('SELECT * FROM tasks WHERE assignee_id = ? ORDER BY due_date, id')
      .all(userId)
      .map(toTask);
  }

  /**
   * FR5: one SQL query that adds a WHERE condition only for the filters that were given.
   * Column names come from COLUMNS (our code); every value goes through a ? placeholder.
   * @param {{ assigneeId?: number, priority?: string, status?: string }} filter
   * @returns {object[]} the matching tasks, in id order (the service sorts them)
   */
  findTasks({ assigneeId, priority, status }) {
    // Declarative: keep the filters that have a value, then turn each into "column = ?"
    const given = Object.entries({ assigneeId, priority, status }).filter(
      ([, value]) => value !== undefined,
    );
    const where = given.map(([field]) => `${COLUMNS[field]} = ?`).join(' AND ');
    const sql = `SELECT * FROM tasks${where ? ` WHERE ${where}` : ''} ORDER BY id`;
    return this.db
      .prepare(sql)
      .all(...given.map(([, value]) => value))
      .map(toTask);
  }

  /** @returns {object | null} the instance of a recurrence with the latest due date */
  findLatestByRecurrence(recurrenceId) {
    return toTask(
      this.db
        .prepare('SELECT * FROM tasks WHERE recurrence_id = ? ORDER BY due_date DESC LIMIT 1')
        .get(recurrenceId),
    );
  }

  /**
   * @param {{ recurrenceId: number, dueDate: string }} period
   * @returns {object | null} the instance for that period
   */
  findByRecurrenceAndDueDate({ recurrenceId, dueDate }) {
    return toTask(
      this.db
        .prepare('SELECT * FROM tasks WHERE recurrence_id = ? AND due_date = ?')
        .get(recurrenceId, dueDate),
    );
  }
}

module.exports = TaskRepository;
