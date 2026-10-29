// InMemoryRepository plus the few feature queries the services need, so unit tests
// run without SQLite. They behave like the real repositories (copies, null when missing).
const InMemoryRepository = require('../../../src/data-access/repositories/InMemoryRepository');

class InMemoryUserRepository extends InMemoryRepository {
  findByEmail(email) {
    return this.findAll().find((user) => user.email === email) ?? null;
  }
}

module.exports = { InMemoryUserRepository };
