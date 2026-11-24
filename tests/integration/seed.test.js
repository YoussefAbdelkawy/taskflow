// Demo data (npm run seed) and the deployment's first start (SEED_ON_EMPTY).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { seed, seedIfEmpty } = require('../../src/data-access/database/seed');
const { createConnection } = require('../../src/data-access/database/connection');

const tempDatabase = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-seed-')), 'test.db');

const count = (databasePath, sql) => {
  const db = createConnection(databasePath);
  try {
    return db.prepare(sql).get().count;
  } finally {
    db.close();
  }
};

describe('seed', () => {
  it('loads the demo users, one project and its tasks', () => {
    const databasePath = tempDatabase();

    const { users, project, tasks } = seed(databasePath);

    expect(Object.keys(users)).toEqual(['Mona', 'Karim', 'Salma', 'Omar', 'Hany']);
    expect(project.id).toBe(1);
    expect(tasks.length).toBeGreaterThanOrEqual(8);
  });

  it('US7-1 every DONE task has a DONE entry in its history, so the completion trend has data', () => {
    const databasePath = tempDatabase();
    seed(databasePath);

    const done = count(databasePath, "SELECT COUNT(*) AS count FROM tasks WHERE status = 'DONE'");
    const logged = count(
      databasePath,
      "SELECT COUNT(DISTINCT task_id) AS count FROM task_status_history WHERE new_status = 'DONE'",
    );
    expect(done).toBeGreaterThan(1);
    expect(logged).toBe(done);
  });

  it('can run twice: the second run replaces the data instead of adding to it', () => {
    const databasePath = tempDatabase();
    seed(databasePath);
    seed(databasePath);

    expect(count(databasePath, 'SELECT COUNT(*) AS count FROM users')).toBe(5);
  });
});

describe('seedIfEmpty (SEED_ON_EMPTY=true on the deployed server)', () => {
  it('seeds an empty database and says so', () => {
    const databasePath = tempDatabase();

    expect(seedIfEmpty(databasePath)).toBe(true);
    expect(count(databasePath, 'SELECT COUNT(*) AS count FROM users')).toBe(5);
  });

  it('leaves a database that already has users alone', () => {
    const databasePath = tempDatabase();
    seed(databasePath);
    const db = createConnection(databasePath);
    db.prepare("DELETE FROM tasks WHERE title = 'Write the weekly report'").run();
    db.close();
    const before = count(databasePath, 'SELECT COUNT(*) AS count FROM tasks');

    expect(seedIfEmpty(databasePath)).toBe(false);
    expect(count(databasePath, 'SELECT COUNT(*) AS count FROM tasks')).toBe(before);
  });
});
