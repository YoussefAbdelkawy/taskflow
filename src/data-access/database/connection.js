// Opens the SQLite database and creates the tables from schema.sql.
// SQLite is built into Node.js (node:sqlite), so nobody needs to install a database server.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

/**
 * @param {string} databasePath - a file path, or ':memory:' for a temporary database
 * @returns {DatabaseSync}
 * effects: opens (or creates) the database, turns on foreign keys, runs schema.sql
 * modifies: the database file
 */
function createConnection(databasePath) {
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  return db;
}

module.exports = { createConnection };
