const BaseRepository = require('./BaseRepository');
const { toRow, insertRow, updateRow, deleteRow } = require('./sqlHelpers');

const TABLE = 'notifications';
const COLUMNS = Object.freeze({
  userId: 'user_id',
  taskId: 'task_id',
  type: 'type',
  message: 'message',
  isRead: 'is_read',
  createdAt: 'created_at',
});

const toNotification = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        taskId: row.task_id,
        type: row.type,
        message: row.message,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      }
    : null;

class NotificationRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  findById(id) {
    return toNotification(this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(id));
  }

  findAll() {
    return this.db.prepare('SELECT * FROM notifications ORDER BY id').all().map(toNotification);
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

  findByUser(userId) {
    return this.db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC')
      .all(userId)
      .map(toNotification);
  }

  markRead(id) {
    return this.update(id, { isRead: true });
  }

  exists({ userId, taskId, type }) {
    return Boolean(
      this.db
        .prepare(
          'SELECT 1 FROM notifications WHERE user_id = ? AND task_id = ? AND type = ? LIMIT 1',
        )
        .get(userId, taskId, type),
    );
  }
}

module.exports = NotificationRepository;
