const BaseRepository = require('./BaseRepository');
const { toRow, insertRow, updateRow, deleteRow } = require('./sqlHelpers');

const TABLE = 'recurrence_rules';
const COLUMNS = Object.freeze({
  frequency: 'frequency',
  lastGeneratedPeriod: 'last_generated_period',
  isActive: 'is_active',
});

const toRule = (row) =>
  row
    ? {
        id: row.id,
        frequency: row.frequency,
        lastGeneratedPeriod: row.last_generated_period,
        isActive: row.is_active === 1,
      }
    : null;

/** Recurrence rules (RECURRENCE_RULE in the ER diagram) in SQLite. */
class RecurrenceRuleRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  findById(id) {
    return toRule(this.db.prepare('SELECT * FROM recurrence_rules WHERE id = ?').get(id));
  }

  findAll() {
    return this.db.prepare('SELECT * FROM recurrence_rules ORDER BY id').all().map(toRule);
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

  /** @returns {object[]} the rules that are switched on */
  findActive() {
    return this.db
      .prepare('SELECT * FROM recurrence_rules WHERE is_active = 1 ORDER BY id')
      .all()
      .map(toRule);
  }
}

module.exports = RecurrenceRuleRepository;
