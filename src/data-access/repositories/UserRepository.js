const BaseRepository = require('./BaseRepository');
const { toRow, insertRow, updateRow, deleteRow } = require('./sqlHelpers');

const TABLE = 'users';
const COLUMNS = Object.freeze({ name: 'name', email: 'email', passwordHash: 'password_hash' });

// Rows from node:sqlite have a null prototype, so always build a fresh plain object.
const toUser = (row) =>
  row ? { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash } : null;

/**
 * Users in SQLite. Returned objects include passwordHash; the service removes it
 * before data leaves the API.
 */
class UserRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  findById(id) {
    return toUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  findAll() {
    return this.db.prepare('SELECT * FROM users ORDER BY id').all().map(toUser);
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

  /**
   * @param {string} email
   * @returns {object | null}
   */
  findByEmail(email) {
    return toUser(this.db.prepare('SELECT * FROM users WHERE email = ?').get(email));
  }
}

module.exports = UserRepository;
