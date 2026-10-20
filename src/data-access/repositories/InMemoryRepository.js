const BaseRepository = require('./BaseRepository');

/**
 * A repository that keeps data in memory (a Map). It is used in UNIT TESTS
 * so that services can be tested without a real database.
 *
 * It always returns copies, so a caller can never change stored data by
 * accident (Lab 3: immutability).
 */
class InMemoryRepository extends BaseRepository {
  constructor(initialItems = []) {
    super();
    this.items = new Map();
    this.nextId = 1;
    initialItems.forEach((item) => this.create(item));
  }

  findById(id) {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  findAll() {
    // Declarative: describe the result (a list of copies), not the loop.
    return [...this.items.values()].map((item) => ({ ...item }));
  }

  create(data) {
    const entity = { ...data, id: this.nextId };
    this.nextId += 1;
    this.items.set(entity.id, entity);
    return { ...entity };
  }

  update(id, changes) {
    const current = this.items.get(id);
    if (!current) return null; // Lab 2: return early

    const updated = { ...current, ...changes, id };
    this.items.set(id, updated);
    return { ...updated };
  }

  delete(id) {
    return this.items.delete(id);
  }
}

module.exports = InMemoryRepository;
