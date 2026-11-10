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
const TaskStatusHistoryRepository = require('./data-access/repositories/TaskStatusHistoryRepository');
const SessionRepository = require('./data-access/repositories/SessionRepository');
const TaskDependencyRepository = require('./data-access/repositories/TaskDependencyRepository');
const CommentRepository = require('./data-access/repositories/CommentRepository');
const NotificationRepository = require('./data-access/repositories/NotificationRepository');

const PasswordHasher = require('./data-access/security/PasswordHasher');
const EventPublisher = require('./business/events/EventPublisher');
const AuthService = require('./business/services/AuthService');
const RecurrenceService = require('./business/services/RecurrenceService');
const AuthorizationService = require('./business/services/AuthorizationService');
const TaskService = require('./business/services/TaskService');
const DependencyService = require('./business/services/DependencyService');
const ProjectService = require('./business/services/ProjectService');
const CommentService = require('./business/services/CommentService');
const NotificationService = require('./business/services/NotificationService');

const HealthController = require('./presentation/controllers/HealthController');
const AuthController = require('./presentation/controllers/AuthController');
const RecurrenceController = require('./presentation/controllers/RecurrenceController');
const TaskController = require('./presentation/controllers/TaskController');
const DependencyController = require('./presentation/controllers/DependencyController');
const ProjectController = require('./presentation/controllers/ProjectController');
const CommentController = require('./presentation/controllers/CommentController');
const NotificationController = require('./presentation/controllers/NotificationController');

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
    taskStatusHistory: new TaskStatusHistoryRepository(db),
    taskDependency: new TaskDependencyRepository(db),
    comment: new CommentRepository(db),
    notification: new NotificationRepository(db),
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
  // FR1 permission checks, shared by every later service (built before them)
  services.authorization = new AuthorizationService({ projectRepository: repositories.project });

  services.dependency = new DependencyService({
    taskRepository: repositories.task,
    taskDependencyRepository: repositories.taskDependency,
    authorizationService: services.authorization,
  });
  services.project = new ProjectService({
    projectRepository: repositories.project,
    userRepository: repositories.user,
    authorizationService: services.authorization,
  });
  services.comment = new CommentService({
    commentRepository: repositories.comment,
    taskRepository: repositories.task,
    authorizationService: services.authorization,
  });
  // FR1: publishes through the SAME eventPublisher that RecurrenceService listens to
  services.task = new TaskService({
    taskRepository: repositories.task,
    historyRepository: repositories.taskStatusHistory,
    projectRepository: repositories.project,
    authorizationService: services.authorization,
    eventPublisher,
    dependencyService: services.dependency,
  });
  services.notification = new NotificationService({
    notificationRepository: repositories.notification,
    taskRepository: repositories.task,
    projectRepository: repositories.project,
  });
  // FR2 listens for TASK_COMPLETED (TaskService publishes it from turn 2 on)
  eventPublisher.subscribe(services.recurrence);
  eventPublisher.subscribe(services.notification);

  // 3. Presentation
  const controllers = {
    health: new HealthController(),
    auth: new AuthController({ authService: services.auth }),
    recurrence: new RecurrenceController({ recurrenceService: services.recurrence }),
    task: new TaskController({ taskService: services.task }),
    dependency: new DependencyController({ dependencyService: services.dependency }),
    project: new ProjectController({ projectService: services.project }),
    comment: new CommentController({ commentService: services.comment }),
    notification: new NotificationController({ notificationService: services.notification }),
  };
  const middleware = { authenticate: createAuthenticate(services.auth) };
  // Built here, started only by server.js
  const scheduler = new Scheduler({
    recurrenceService: services.recurrence,
    notificationService: services.notification,
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
