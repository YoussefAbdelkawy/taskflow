const { createRepositories, userData, projectData } = require('./helpers');

describe('ProjectRepository', () => {
  let users;
  let projects;

  beforeEach(() => {
    ({ users, projects } = createRepositories());
  });

  it('create → findById round trip with camelCase keys', () => {
    const created = projects.create(projectData());

    expect(created).toEqual({ id: 1, ...projectData() });
    expect(projects.findById(created.id)).toEqual(created);
  });

  it('updates, lists and deletes projects', () => {
    const created = projects.create(projectData());

    expect(projects.update(created.id, { name: 'Shop' })).toEqual({ ...created, name: 'Shop' });
    expect(projects.update(99, { name: 'x' })).toBeNull();
    expect(projects.findAll()).toHaveLength(1);
    expect(projects.delete(created.id)).toBe(true);
    expect(projects.findById(created.id)).toBeNull();
  });

  it('adds members and lists them with name, email and role', () => {
    const manager = users.create(userData());
    const member = users.create(userData('omar@taskflow.test'));
    const project = projects.create(projectData());

    projects.addMember({ projectId: project.id, userId: manager.id, role: 'MANAGER' });
    projects.addMember({ projectId: project.id, userId: member.id, role: 'MEMBER' });

    expect(projects.findMembers(project.id)).toEqual([
      { userId: manager.id, name: 'Sara', email: 'sara@taskflow.test', role: 'MANAGER' },
      { userId: member.id, name: 'Sara', email: 'omar@taskflow.test', role: 'MEMBER' },
    ]);
    expect(projects.findMemberRole({ projectId: project.id, userId: manager.id })).toBe('MANAGER');
    expect(projects.findMemberRole({ projectId: project.id, userId: member.id })).toBe('MEMBER');
  });

  it('findMemberRole returns null for a non-member', () => {
    const outsider = users.create(userData());
    const project = projects.create(projectData());

    expect(projects.findMemberRole({ projectId: project.id, userId: outsider.id })).toBeNull();
  });

  it('findByUser returns only the projects the user is a member of', () => {
    const user = users.create(userData());
    const mine = projects.create(projectData());
    projects.create({ ...projectData(), name: 'Other' });
    projects.addMember({ projectId: mine.id, userId: user.id, role: 'MEMBER' });

    expect(projects.findByUser(user.id)).toEqual([mine]);
  });
});
