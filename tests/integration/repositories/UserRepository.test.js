const { createRepositories, userData } = require('./helpers');

describe('UserRepository', () => {
  let users;

  beforeEach(() => {
    ({ users } = createRepositories());
  });

  it('create → findById round trip with camelCase keys', () => {
    const created = users.create(userData());

    expect(created).toEqual({ id: 1, ...userData() });
    expect(users.findById(created.id)).toEqual(created);
  });

  it('returns null when the user does not exist', () => {
    expect(users.findById(99)).toBeNull();
    expect(users.findByEmail('nobody@taskflow.test')).toBeNull();
    expect(users.update(99, { name: 'x' })).toBeNull();
  });

  it('finds a user by email', () => {
    const created = users.create(userData());

    expect(users.findByEmail('sara@taskflow.test')).toEqual(created);
  });

  it('updates only the given fields, lists and deletes', () => {
    const created = users.create(userData());
    users.create(userData('omar@taskflow.test'));

    expect(users.update(created.id, { name: 'Sara A.' })).toEqual({ ...created, name: 'Sara A.' });
    expect(users.findAll()).toHaveLength(2);
    expect(users.delete(created.id)).toBe(true);
    expect(users.delete(created.id)).toBe(false);
  });
});
