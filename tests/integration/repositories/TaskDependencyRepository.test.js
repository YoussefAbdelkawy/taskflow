const TaskDependencyRepository = require('../../../src/data-access/repositories/TaskDependencyRepository');
const { createRepositories, userData, projectData, taskData } = require('./helpers');

describe('TaskDependencyRepository', () => {
  let dependencies;
  let tasks;
  let a;
  let b;

  beforeEach(() => {
    const repositories = createRepositories();
    dependencies = new TaskDependencyRepository(repositories.db);
    tasks = repositories.tasks;
    repositories.users.create(userData());
    repositories.projects.create(projectData());
    a = tasks.create(taskData({ title: 'A' }));
    b = tasks.create(taskData({ title: 'B' }));
  });

  it('add → findPrerequisites round trip', () => {
    dependencies.add({ taskId: b.id, dependsOnId: a.id });

    expect(dependencies.findPrerequisites(b.id)).toEqual([
      { id: a.id, projectId: 1, title: 'A', status: 'TO_DO' },
    ]);
    expect(dependencies.findPrerequisites(a.id)).toEqual([]);
  });

  it('findAllInProject returns the project’s links', () => {
    dependencies.add({ taskId: b.id, dependsOnId: a.id });

    expect(dependencies.findAllInProject(1)).toEqual([{ taskId: b.id, dependsOnId: a.id }]);
    expect(dependencies.findAllInProject(2)).toEqual([]);
  });

  it('remove deletes only that edge', () => {
    dependencies.add({ taskId: b.id, dependsOnId: a.id });

    expect(dependencies.remove({ taskId: b.id, dependsOnId: a.id })).toBe(true);
    expect(dependencies.findPrerequisites(b.id)).toEqual([]);
    expect(dependencies.remove({ taskId: b.id, dependsOnId: a.id })).toBe(false);
  });

  it('runInTransaction commits when work succeeds', () => {
    const link = dependencies.runInTransaction(() =>
      dependencies.add({ taskId: b.id, dependsOnId: a.id }),
    );

    expect(link).toEqual({ taskId: b.id, dependsOnId: a.id });
    expect(dependencies.findPrerequisites(b.id)).toHaveLength(1);
  });

  it('runInTransaction rolls back when work throws', () => {
    expect(() =>
      dependencies.runInTransaction(() => {
        dependencies.add({ taskId: b.id, dependsOnId: a.id });
        throw new Error('boom');
      }),
    ).toThrow('boom');

    expect(dependencies.findPrerequisites(b.id)).toEqual([]);
  });
});
