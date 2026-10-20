/**
 * The "composition root": the ONE place where all the objects are created and
 * connected to each other (dependency injection).
 *
 * Order is always bottom to top:  database -> repositories -> services -> controllers
 *
 * Nothing else in the project uses `new SomeRepository()` or `new SomeService()`.
 * Services receive what they need through their constructor, which is what makes
 * them easy to unit test (pass an InMemoryRepository instead of the real one).
 *
 * This is the only file allowed to import from every layer.
 */
const { createConnection } = require('./data-access/database/connection');
const HealthController = require('./presentation/controllers/HealthController');

function createContainer({ databasePath }) {
  // 1. Data access
  const db = createConnection(databasePath);
  const repositories = {
    // task: new TaskRepository(db),
  };

  // 2. Business
  const services = {
    // task: new TaskService({ taskRepository: repositories.task }),
  };

  // 3. Presentation
  const controllers = {
    health: new HealthController(),
    // task: new TaskController({ taskService: services.task }),
  };

  return { db, repositories, services, controllers };
}

module.exports = { createContainer };
