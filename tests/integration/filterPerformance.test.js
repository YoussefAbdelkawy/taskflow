// FR5 NFR Performance: filtering or sorting up to 500 tasks returns results within 2 seconds.
// Real SQLite (':memory:'), real TaskRepository, real TaskService.
const { createContainer } = require('../../src/container');

const TASK_COUNT = 500;
const LIMIT_MS = 2000;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const STATUSES = ['TO_DO', 'IN_PROGRESS', 'DONE'];

// A day in 2026 spread over the year, as YYYY-MM-DD
const dueDateFor = (index) =>
  new Date(Date.UTC(2026, 0, 1 + (index % 365))).toISOString().slice(0, 10);

describe('NFR Performance (FR5): 500 tasks', () => {
  let container;
  let karim;

  beforeAll(() => {
    container = createContainer({ databasePath: ':memory:' });
    const { user, project, task } = container.repositories;
    karim = user.create({ name: 'Karim', email: 'karim@taskflow.test', passwordHash: 'x:y' });
    const website = project.create({ name: 'Website', description: '', startDate: '2026-01-01' });
    project.addMember({ projectId: website.id, userId: karim.id, role: 'MEMBER' });
    for (let index = 0; index < TASK_COUNT; index += 1) {
      task.create({
        projectId: website.id,
        assigneeId: karim.id,
        title: `Task ${index}`,
        description: '',
        // floor(index / 3) so every priority meets every status
        status: STATUSES[Math.floor(index / PRIORITIES.length) % STATUSES.length],
        priority: PRIORITIES[index % PRIORITIES.length],
        dueDate: dueDateFor(index * 7),
      });
    }
  });

  const timed = (work) => {
    const start = performance.now();
    const result = work();
    return { result, elapsed: performance.now() - start };
  };

  it('the schema has the idx_tasks_filter index on tasks', () => {
    const index = container.db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_filter'")
      .get();

    expect(index?.sql).toMatch(/tasks\s*\(assignee_id, priority, status, due_date\)/);
  });

  it('sorting all 500 tasks takes under 2000 ms', () => {
    const { result, elapsed } = timed(() => container.services.task.getTasks({}, 'desc', karim));

    expect(result).toHaveLength(TASK_COUNT);
    expect(result[0].dueDate >= result[result.length - 1].dueDate).toBe(true);
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });

  it('filtering + sorting 500 tasks takes under 2000 ms', () => {
    const { result, elapsed } = timed(() =>
      container.services.task.getTasks({ priority: 'HIGH', status: 'TO_DO' }, 'asc', karim),
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((task) => task.priority === 'HIGH' && task.status === 'TO_DO')).toBe(true);
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });
});
