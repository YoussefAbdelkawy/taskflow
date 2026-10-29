const fs = require('node:fs');
const path = require('node:path');
const { createConnection } = require('../../src/data-access/database/connection');

const SCHEMA_FILE = path.join(__dirname, '../../src/data-access/database/schema.sql');

describe('schema.sql', () => {
  it('creates all 9 tables from the Milestone 1 ER diagram', () => {
    const db = createConnection(':memory:');

    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name)
      .sort();

    expect(names).toEqual([
      'comments',
      'notifications',
      'project_members',
      'projects',
      'recurrence_rules',
      'task_dependencies',
      'task_status_history',
      'tasks',
      'users',
    ]);
  });

  it('can run twice on the same database (every statement uses IF NOT EXISTS)', () => {
    const db = createConnection(':memory:');

    expect(() => db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'))).not.toThrow();
  });
});
