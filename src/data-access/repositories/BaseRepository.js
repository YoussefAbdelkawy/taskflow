/**
 * BaseRepository: the CONTRACT every repository must follow.
 *
 * JavaScript has no `interface` keyword, so this class plays that role:
 * every method throws until a real repository overrides it.
 *
 * Why it matters (Dependency Inversion, the "D" in SOLID):
 * services depend on this contract, not on SQLite. In unit tests we hand a
 * service an InMemoryRepository instead, so tests run without a database.
 *
 * How to make your own:
 *   class TaskRepository extends BaseRepository { ... }  and implement all 5 methods
 *   using SQL on the database connection you receive in the constructor.
 *
 * Feature-specific queries (e.g. findByAssignee) are added in YOUR repository,
 * not here.
 */
class BaseRepository {
  /**
   * @param {number} _id
   * @returns {object | null}
   * requires: id is a positive integer
   * effects: returns a copy of the entity with this id, or null if none exists
   * modifies: nothing
   */
  findById(_id) {
    throw new Error(`${this.constructor.name}.findById() is not implemented`);
  }

  /**
   * @returns {object[]}
   * effects: returns copies of all entities (an empty array if there are none)
   * modifies: nothing
   */
  findAll() {
    throw new Error(`${this.constructor.name}.findAll() is not implemented`);
  }

  /**
   * @param {object} _data - the entity fields, without an id
   * @returns {object}
   * requires: data has no id field
   * effects: stores the entity and returns a copy that includes its new id
   * modifies: the stored collection
   */
  create(_data) {
    throw new Error(`${this.constructor.name}.create() is not implemented`);
  }

  /**
   * @param {number} _id
   * @param {object} _changes - only the fields that change
   * @returns {object | null}
   * effects: applies the changes and returns the updated copy, or null if the id does not exist
   * modifies: the stored entity with this id
   */
  update(_id, _changes) {
    throw new Error(`${this.constructor.name}.update() is not implemented`);
  }

  /**
   * @param {number} _id
   * @returns {boolean}
   * effects: removes the entity; returns true if it existed, false otherwise
   * modifies: the stored collection
   */
  delete(_id) {
    throw new Error(`${this.constructor.name}.delete() is not implemented`);
  }
}

module.exports = BaseRepository;
