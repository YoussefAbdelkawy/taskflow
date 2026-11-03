const BaseRepository = require('./BaseRepository');
const { toRow, insertRow, updateRow, deleteRow } = require('./sqlHelpers');

const TABLE = 'task_status_history';
const COLUMNS = Object.freeze({
  taskId: 'task_id',
  changedBy: 'changed_by',
  oldStatus: 'old_status',
  newStatus: 'new_status',
  changedAt: 'changed_at',
});

// Every read joins users, so each entry also says who made the change by name.
const SELECT_WITH_NAME = `SELECT h.*, u.name AS changed_by_name
  FROM task_status_history h
  JOIN users u ON u.id = h.changed_by`;
// Oldest first; id breaks ties between changes with the same timestamp.
const OLDEST_FIRST = 'ORDER BY h.changed_at, h.id';

const toEntry = (row) =>
  row
    ? {
        id: row.id,
        taskId: row.task_id,
        changedBy: row.changed_by,
        oldStatus: row.old_status,
        newStatus: row.new_status,
        changedAt: row.changed_at,
        changedByName: row.changed_by_name,
      }
    : null;

/** The status changes of tasks (FR1: each change is logged with a timestamp) in SQLite. */
class TaskStatusHistoryRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  findById(id) {
    return toEntry(this.db.prepare(`${SELECT_WITH_NAME} WHERE h.id = ?`).get(id));
  }

  findAll() {
    return this.db.prepare(`${SELECT_WITH_NAME} ${OLDEST_FIRST}`).all().map(toEntry);
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

  /** @returns {object[]} the status changes of one task, oldest first */
  findByTask(taskId) {
    return this.db
      .prepare(`${SELECT_WITH_NAME} WHERE h.task_id = ? ${OLDEST_FIRST}`)
      .all(taskId)
      .map(toEntry);
  }
}

module.exports = TaskStatusHistoryRepository;
