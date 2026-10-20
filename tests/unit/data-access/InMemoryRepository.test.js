const BaseRepository = require('../../../src/data-access/repositories/BaseRepository');
const InMemoryRepository = require('../../../src/data-access/repositories/InMemoryRepository');

describe('BaseRepository', () => {
  it('forces subclasses to implement every method', () => {
    const repository = new BaseRepository();

    expect(() => repository.findAll()).toThrow('findAll() is not implemented');
    expect(() => repository.findById(1)).toThrow('findById() is not implemented');
  });
});

describe('InMemoryRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new InMemoryRepository();
  });

  it('gives each created entity a new id', () => {
    const first = repository.create({ title: 'Write report' });
    const second = repository.create({ title: 'Review PR' });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
  });

  it('returns null when the id does not exist', () => {
    expect(repository.findById(99)).toBeNull();
    expect(repository.update(99, { title: 'x' })).toBeNull();
  });

  it('updates only the given fields and keeps the id', () => {
    const task = repository.create({ title: 'Old', status: 'TODO' });

    const updated = repository.update(task.id, { status: 'DONE' });

    expect(updated).toEqual({ id: task.id, title: 'Old', status: 'DONE' });
  });

  it('returns copies, so callers cannot change stored data by accident', () => {
    const task = repository.create({ title: 'Original' });

    const copy = repository.findById(task.id);
    copy.title = 'Changed outside';

    expect(repository.findById(task.id).title).toBe('Original');
  });

  it('deletes an entity and reports whether it existed', () => {
    const task = repository.create({ title: 'Temp' });

    expect(repository.delete(task.id)).toBe(true);
    expect(repository.delete(task.id)).toBe(false);
    expect(repository.findAll()).toEqual([]);
  });
});
