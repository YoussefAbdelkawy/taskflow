const CommentRepository = require('../../../src/data-access/repositories/CommentRepository');
const { createRepositories, projectData, taskData, userData } = require('./helpers');

describe('CommentRepository', () => {
  let users;
  let projects;
  let tasks;
  let comments;
  let member;
  let task;

  beforeEach(() => {
    const repositories = createRepositories();
    ({ users, projects, tasks } = repositories);
    comments = new CommentRepository(repositories.db);
    member = users.create(userData('karim@taskflow.test'));
    const project = projects.create(projectData());
    task = tasks.create(taskData({ projectId: project.id, assigneeId: member.id }));
  });

  it('creates a comment with camelCase fields and the author name', () => {
    const created = comments.create({
      taskId: task.id,
      userId: member.id,
      content: 'Started on this',
      createdAt: '2026-11-05T09:00:00.000Z',
    });

    expect(created).toEqual({
      id: 1,
      taskId: task.id,
      userId: member.id,
      content: 'Started on this',
      createdAt: '2026-11-05T09:00:00.000Z',
      name: 'Sara',
    });
  });

  it('returns comments oldest first with the author name', () => {
    comments.create({
      taskId: task.id,
      userId: member.id,
      content: 'Later update',
      createdAt: '2026-11-05T10:00:00.000Z',
    });
    comments.create({
      taskId: task.id,
      userId: member.id,
      content: 'Earlier update',
      createdAt: '2026-11-05T09:00:00.000Z',
    });

    expect(comments.findByTask(task.id).map(({ content, name }) => ({ content, name }))).toEqual([
      { content: 'Earlier update', name: 'Sara' },
      { content: 'Later update', name: 'Sara' },
    ]);
  });

  it('returns an empty list when the task has no comments', () => {
    expect(comments.findByTask(task.id)).toEqual([]);
  });
});
