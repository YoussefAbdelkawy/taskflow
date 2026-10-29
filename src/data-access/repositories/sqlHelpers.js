/**
 * Small helpers shared by the SQLite repositories.
 *
 * Column names always come from a repository's own fixed COLUMNS table (never from
 * user input), and every value is passed through a `?` placeholder.
 */

/**
 * @param {object} data - camelCase fields
 * @param {object} columns - camelCase field -> snake_case column, e.g. { dueDate: 'due_date' }
 * @returns {object} snake_case row with only the fields that are set
 * effects: booleans become 0/1 because SQLite cannot store true/false
 * modifies: nothing
 */
function toRow(data, columns) {
  // Declarative: keep the known, defined fields and rename them
  return Object.fromEntries(
    Object.entries(columns)
      .filter(([field]) => data[field] !== undefined)
      .map(([field, column]) => [column, toSqlValue(data[field])]),
  );
}

const toSqlValue = (value) => (typeof value === 'boolean' ? Number(value) : value);

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ table: string, row: object }} input - row from toRow()
 * @returns {number} the new row id
 * modifies: the table
 */
function insertRow(db, { table, row }) {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  return Number(db.prepare(sql).run(...Object.values(row)).lastInsertRowid);
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ table: string, id: number, row: object }} input - row from toRow()
 * @returns {boolean} true if a row with this id exists
 * modifies: the row with this id
 */
function updateRow(db, { table, id, row }) {
  const columns = Object.keys(row);
  if (columns.length === 0) return exists(db, { table, id });

  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${assignments} WHERE id = ?`;
  return db.prepare(sql).run(...Object.values(row), id).changes > 0;
}

function exists(db, { table, id }) {
  return db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id) !== undefined;
}

/**
 * @returns {boolean} true if the row existed
 * modifies: the table
 */
function deleteRow(db, { table, id }) {
  return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
}

module.exports = { toRow, insertRow, updateRow, deleteRow };
