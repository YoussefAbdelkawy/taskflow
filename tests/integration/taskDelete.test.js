// US8-3 through the real services and SQLite: deleting a task takes its rows with it
// (ON DELETE CASCADE) and unblocks the tasks that depended on it.
const { createContainer } = require('../../src/container');

const PASSWORD = 'secret123';

// One project: Mona manages it, Karim is a member.
function addTeam(container) {
  const { user, project } = container.repositories;
  const passwordHash = container.passwordHasher.hash(PASSWORD);
  const mona = user.create({ name: 'Mona', email: 'mona@taskflow.test', passwordHash });
  const karim = user.create({ name: 'Karim', email: 'karim@taskflow.test', passwordHash });
  const website = project.create({ name: 'Website', description: '', startDate: '2026-10-01' });
  project.addMember({ projectId: website.id, userId: mona.id, role: 'MANAGER' });
  project.addMember({ projectId: website.id, userId: karim.id, role: 'MEMBER' });
  return { mona, karim, website };
}

describe('deleting a task (US8-3, real SQLite)', () => {
  let container;
  let services;
  let repositories;
  let mona;
  let karim;
  let taskA;
  let taskB;

  beforeEach(() => {
    container = createContainer({ databasePath: ':memory:' });
    ({ services, repositories } = container);
    let website;
    ({ mona, karim, website } = addTeam(container));
    const newTask = (title) => ({
      projectId: website.id,
      title,
      assigneeId: karim.id,
      dueDate: '2026-12-01',
      priority: 'HIGH',
    });
    taskA = services.task.createTask(newTask('Task A'), mona); // also notifies Karim (ASSIGNED)
    taskB = services.task.createTask(newTask('Task B'), mona);
    services.dependency.addDependency({ taskId: taskB.id, dependsOnId: taskA.id, user: mona });
    services.task.changeStatus({ taskId: taskA.id, status: 'IN_PROGRESS', user: karim });
    services.comment.addComment({ taskId: taskA.id, content: 'Started', user: karim });
  });

  afterEach(() => container.db.close());

  const notificationsFor = (taskId) =>
    repositories.notification.findByUser(karim.id).filter((n) => n.taskId === taskId);

  it('US8-3 AC2 history, comments, dependency links and notifications are removed with it', () => {
    // Before: every kind of row exists, so the "after" checks prove something
    expect(repositories.taskStatusHistory.findByTask(taskA.id)).toHaveLength(1);
    expect(repositories.comment.findByTask(taskA.id)).toHaveLength(1);
    expect(repositories.taskDependency.findPrerequisites(taskB.id)).toHaveLength(1);
    expect(notificationsFor(taskA.id)).not.toHaveLength(0);

    services.task.deleteTask(taskA.id, mona);

    expect(repositories.task.findById(taskA.id)).toBeNull();
    expect(repositories.taskStatusHistory.findByTask(taskA.id)).toEqual([]);
    expect(repositories.comment.findByTask(taskA.id)).toEqual([]);
    expect(repositories.taskDependency.findPrerequisites(taskB.id)).toEqual([]);
    expect(notificationsFor(taskA.id)).toEqual([]);
  });

  it('US8-3 AC2 the other tasks and their rows are untouched', () => {
    services.task.deleteTask(taskA.id, mona);

    expect(repositories.task.findById(taskB.id)).toEqual(taskB);
    expect(notificationsFor(taskB.id)).not.toHaveLength(0);
  });

  it('US8-3 AC3 a task that depended on it is no longer blocked and can start', () => {
    expect(services.dependency.isBlocked(taskB.id)).toBe(true);

    services.task.deleteTask(taskA.id, mona);

    expect(services.dependency.isBlocked(taskB.id)).toBe(false);
    expect(
      services.task.changeStatus({ taskId: taskB.id, status: 'IN_PROGRESS', user: karim }).status,
    ).toBe('IN_PROGRESS');
  });

  it('US8-3 a rejected delete (member) leaves every row in place', () => {
    expect(() => services.task.deleteTask(taskA.id, karim)).toThrow(
      'Only a project manager can delete tasks',
    );

    expect(repositories.task.findById(taskA.id)).not.toBeNull();
    expect(repositories.comment.findByTask(taskA.id)).toHaveLength(1);
    expect(services.dependency.isBlocked(taskB.id)).toBe(true);
  });
});
