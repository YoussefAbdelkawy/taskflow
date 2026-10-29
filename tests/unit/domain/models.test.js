const User = require('../../../src/domain/User');
const Project = require('../../../src/domain/Project');
const ProjectMember = require('../../../src/domain/ProjectMember');
const Task = require('../../../src/domain/Task');
const Comment = require('../../../src/domain/Comment');
const Notification = require('../../../src/domain/Notification');

const taskWith = (status) =>
  new Task({
    id: 1,
    projectId: 2,
    assigneeId: 3,
    recurrenceId: null,
    title: 'Weekly report',
    description: '',
    status,
    priority: 'MEDIUM',
    dueDate: '2026-11-02',
  });

describe('Task.isDone()', () => {
  it('is true for DONE', () => {
    expect(taskWith('DONE').isDone()).toBe(true);
  });

  it.each(['TO_DO', 'IN_PROGRESS'])('is false for %s', (status) => {
    expect(taskWith(status).isDone()).toBe(false);
  });
});

describe('domain models', () => {
  it('build from one object with the class diagram fields', () => {
    expect(taskWith('TO_DO')).toMatchObject({ id: 1, projectId: 2, dueDate: '2026-11-02' });
    expect({ ...new User({ id: 1, name: 'Sara', email: 's@x.com' }) }).toEqual({
      id: 1,
      name: 'Sara',
      email: 's@x.com',
    });
    expect({
      ...new Project({ id: 1, name: 'P', description: 'd', startDate: '2026-10-01' }),
    }).toEqual({ id: 1, name: 'P', description: 'd', startDate: '2026-10-01' });
    expect({ ...new ProjectMember({ projectId: 1, userId: 2, role: 'MANAGER' }) }).toEqual({
      projectId: 1,
      userId: 2,
      role: 'MANAGER',
    });
    expect({
      ...new Comment({ id: 1, taskId: 2, userId: 3, content: 'Hi', createdAt: 't' }),
    }).toEqual({ id: 1, taskId: 2, userId: 3, content: 'Hi', createdAt: 't' });
    expect({
      ...new Notification({
        id: 1,
        userId: 2,
        taskId: 3,
        type: 'ASSIGNED',
        message: 'm',
        isRead: false,
        createdAt: 't',
      }),
    }).toEqual({
      id: 1,
      userId: 2,
      taskId: 3,
      type: 'ASSIGNED',
      message: 'm',
      isRead: false,
      createdAt: 't',
    });
  });
});
