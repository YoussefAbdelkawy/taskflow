const { createContainer } = require('../../../src/container');

describe('NotificationRepository', () => {
  let container;
  let users;
  let task;

  beforeEach(() => {
    container = createContainer({ databasePath: ':memory:' });
    users = [
      container.repositories.user.create({
        name: 'Karim',
        email: 'karim@test',
        passwordHash: 'x:y',
      }),
      container.repositories.user.create({ name: 'Omar', email: 'omar@test', passwordHash: 'x:y' }),
    ];
    const project = container.repositories.project.create({
      name: 'Website',
      description: '',
      startDate: '2026-11-01',
    });
    task = container.repositories.task.create({
      projectId: project.id,
      assigneeId: users[0].id,
      title: 'Design',
      description: '',
      status: 'TO_DO',
      priority: 'HIGH',
      dueDate: '2026-11-11',
    });
  });

  const save = (userId, type, createdAt) =>
    container.repositories.notification.create({
      userId,
      taskId: task.id,
      type,
      message: type,
      createdAt,
    });

  it('returns only one user’s notifications, newest first, with camelCase fields', () => {
    const older = save(users[0].id, 'ASSIGNED', '2026-11-09T12:00:00.000Z');
    const newer = save(users[0].id, 'DUE_SOON', '2026-11-10T12:00:00.000Z');
    save(users[1].id, 'OVERDUE', '2026-11-11T12:00:00.000Z');

    expect(container.repositories.notification.findByUser(users[0].id)).toEqual([newer, older]);
    expect(newer).toMatchObject({ taskId: task.id, userId: users[0].id, isRead: false });
  });

  it('marks a notification read and finds an existing user/task/type combination', () => {
    const notification = save(users[0].id, 'ASSIGNED', '2026-11-10T12:00:00.000Z');
    const lookup = { userId: users[0].id, taskId: task.id, type: 'ASSIGNED' };

    expect(container.repositories.notification.exists(lookup)).toBe(true);
    expect(container.repositories.notification.exists({ ...lookup, userId: users[1].id })).toBe(
      false,
    );
    expect(container.repositories.notification.markRead(notification.id).isRead).toBe(true);
  });
});
