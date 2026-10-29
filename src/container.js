/**
 * The "composition root": the ONE place where all the objects are created and
 * connected to each other (dependency injection).
 *
 * Order is always bottom to top:  database -> repositories -> services -> controllers
 * (then the authenticate middleware and the Scheduler, which use the services).
 *
 * Nothing else in the project uses `new SomeRepository()` or `new SomeService()`.
 * Services receive what they need through their constructor, which is what makes
 * them easy to unit test (pass an InMemoryRepository instead of the real one).
 *
 * This is the only file allowed to import from every layer.
 */
const config = require('./config');
const { createConnection } = require('./data-access/database/connection');
const UserRepository = require('./data-access/repositories/UserRepository');
const ProjectRepository = require('./data-access/repositories/ProjectRepository');
const TaskRepository = require('./data-access/repositories/TaskRepository');
const RecurrenceRuleRepository = require('./data-access/repositories/RecurrenceRuleRepository');
const SessionRepository = require('./data-access/repositories/SessionRepository');
const PasswordHasher = require('./data-access/security/PasswordHasher');
const EventPublisher = require('./business/events/EventPublisher');
const AuthService = require('./business/services/AuthService');
const RecurrenceService = require('./business/services/RecurrenceService');
const HealthController = require('./presentation/controllers/HealthController');
const AuthController = require('./presentation/controllers/AuthController');
const RecurrenceController = require('./presentation/controllers/RecurrenceController');
const { createAuthenticate } = require('./presentation/middleware/authenticate');
const Scheduler = require('./presentation/scheduler/Scheduler');

function createContainer({ databasePath, schedulerIntervalMs = config.schedulerIntervalMs }) {
  // 1. Data access
  const db = createConnection(databasePath);
  const repositories = {
    user: new UserRepository(db),
    project: new ProjectRepository(db),
    task: new TaskRepository(db),
    recurrenceRule: new RecurrenceRuleRepository(db),
    session: new SessionRepository(),
  };
  const passwordHasher = new PasswordHasher();

  // 2. Business
  const eventPublisher = new EventPublisher();
  const services = {
    auth: new AuthService({
      userRepository: repositories.user,
      sessionRepository: repositories.session,
      passwordHasher,
    }),
    recurrence: new RecurrenceService({
      recurrenceRuleRepository: repositories.recurrenceRule,
      taskRepository: repositories.task,
      projectRepository: repositories.project,
    }),
  };
  // FR2 listens for TASK_COMPLETED (TaskService publishes it from turn 2 on)
  eventPublisher.subscribe(services.recurrence);

  // 3. Presentation
  const controllers = {
    health: new HealthController(),
    auth: new AuthController({ authService: services.auth }),
    recurrence: new RecurrenceController({ recurrenceService: services.recurrence }),
  };
  const middleware = { authenticate: createAuthenticate(services.auth) };
  // Built here, started only by server.js
  const scheduler = new Scheduler({
    recurrenceService: services.recurrence,
    intervalMs: schedulerIntervalMs,
  });

  return {
    db,
    repositories,
    passwordHasher,
    eventPublisher,
    services,
    controllers,
    middleware,
    scheduler,
  };
}

module.exports = { createContainer };
