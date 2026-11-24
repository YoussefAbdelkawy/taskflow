// Demo data for the beta: `npm run seed`.
// Deletes every old row, then adds the users, one project and its tasks through the repositories.
const config = require('../../config');
const { createConnection } = require('./connection');
const UserRepository = require('../repositories/UserRepository');
const ProjectRepository = require('../repositories/ProjectRepository');
const TaskRepository = require('../repositories/TaskRepository');
const TaskStatusHistoryRepository = require('../repositories/TaskStatusHistoryRepository');
const PasswordHasher = require('../security/PasswordHasher');
const { TaskStatus, Priority, Role } = require('../../domain/enums');

const PASSWORD = 'Password123!';

// Children first, so no row is left pointing at a deleted one. Fixed names, never user input.
const TABLES_TO_CLEAR = Object.freeze([
  'task_status_history',
  'comments',
  'notifications',
  'task_dependencies',
  'tasks',
  'recurrence_rules',
  'project_members',
  'projects',
  'users',
]);

// role null = the user is in no project (Hany, for the 403 demo)
const USERS = Object.freeze([
  { name: 'Mona', email: 'mona@taskflow.test', role: Role.MANAGER },
  { name: 'Karim', email: 'karim@taskflow.test', role: Role.MEMBER },
  { name: 'Salma', email: 'salma@taskflow.test', role: Role.MEMBER },
  { name: 'Omar', email: 'omar@taskflow.test', role: Role.MEMBER },
  { name: 'Hany', email: 'hany@taskflow.test', role: null },
]);

const PROJECT = Object.freeze({
  name: 'Website Relaunch',
  description: 'The new company website',
  startDaysAgo: 14,
});

// dueInDays is counted from today: 0 and 1 are due within 24 h, a negative number is in the past.
const TASKS = Object.freeze([
  {
    title: 'Design the home page',
    description: 'Hero section, navigation and footer',
    assignee: 'Karim',
    priority: Priority.HIGH,
    status: TaskStatus.TO_DO,
    dueInDays: 0,
  },
  {
    title: 'Write the API guide',
    description: 'One page per endpoint',
    assignee: 'Salma',
    priority: Priority.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    dueInDays: 1,
  },
  {
    title: 'Fix the login bug',
    description: 'Login fails when the email has capital letters',
    assignee: 'Omar',
    priority: Priority.HIGH,
    status: TaskStatus.TO_DO,
    dueInDays: -2,
  },
  {
    title: 'Set up the test server',
    description: 'Same settings as production',
    assignee: 'Karim',
    priority: Priority.LOW,
    status: TaskStatus.DONE,
    dueInDays: -5,
    completedDaysAgo: 6,
  },
  {
    title: 'Collect the old site analytics',
    description: 'Top pages and search terms from the last year',
    assignee: 'Salma',
    priority: Priority.MEDIUM,
    status: TaskStatus.DONE,
    dueInDays: -12,
    completedDaysAgo: 13,
  },
  {
    title: 'Agree on the sitemap',
    description: 'Pages, URLs and redirects from the old site',
    assignee: 'Omar',
    priority: Priority.HIGH,
    status: TaskStatus.DONE,
    dueInDays: -9,
    completedDaysAgo: 10,
  },
  {
    title: 'Book the photo shoot',
    description: 'Team photos for the about page',
    assignee: 'Karim',
    priority: Priority.LOW,
    status: TaskStatus.DONE,
    dueInDays: -2,
    completedDaysAgo: 3,
  },
  {
    title: 'Review the colour palette',
    description: 'Check contrast for accessibility',
    assignee: 'Omar',
    priority: Priority.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    dueInDays: 3,
  },
  {
    title: 'Write the weekly report',
    description: 'Progress, risks and next steps',
    assignee: 'Karim',
    priority: Priority.MEDIUM,
    status: TaskStatus.TO_DO,
    dueInDays: 4,
  },
  {
    title: 'Prepare the launch email',
    description: 'Short announcement for customers',
    assignee: 'Salma',
    priority: Priority.LOW,
    status: TaskStatus.TO_DO,
    dueInDays: 7,
  },
  {
    title: 'Approve the launch budget',
    description: 'Hosting, photos and the launch campaign',
    assignee: 'Mona',
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    dueInDays: 2,
  },
  {
    title: 'Review the sprint plan with the team',
    description: 'Check scope and owners for the next two weeks',
    assignee: 'Mona',
    priority: Priority.MEDIUM,
    status: TaskStatus.TO_DO,
    dueInDays: 5,
  },
  {
    title: 'Plan the user interviews',
    description: 'Five customers, 30 minutes each',
    assignee: 'Salma',
    priority: Priority.HIGH,
    status: TaskStatus.TO_DO,
    dueInDays: 10,
  },
]);

/**
 * @param {number} days - may be negative
 * @returns {string} today's date (UTC) moved by `days`, as YYYY-MM-DD
 */
function dateInDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function clearTables(db) {
  // Imperative: one DELETE per table, in a fixed order
  for (const table of TABLES_TO_CLEAR) db.exec(`DELETE FROM ${table}`);
  // Restart the ids at 1, so the seeded project is always project 1
  db.exec('DELETE FROM sqlite_sequence');
}

/** @returns {object} name -> saved user */
function addUsers(userRepository, passwordHasher) {
  // Declarative: one saved user per entry, each with its own salted hash
  return Object.fromEntries(
    USERS.map(({ name, email }) => [
      name,
      userRepository.create({ name, email, passwordHash: passwordHasher.hash(PASSWORD) }),
    ]),
  );
}

function addProject(projectRepository, savedUsers) {
  const project = projectRepository.create({
    name: PROJECT.name,
    description: PROJECT.description,
    startDate: dateInDays(-PROJECT.startDaysAgo),
  });
  USERS.filter(({ role }) => role !== null).forEach(({ name, role }) =>
    projectRepository.addMember({ projectId: project.id, userId: savedUsers[name].id, role }),
  );
  return project;
}

function addTasks(taskRepository, { projectId, savedUsers }) {
  // Only the task columns go to the repository; completedDaysAgo is used by addCompletions
  return TASKS.map(({ assignee, dueInDays, title, description, priority, status }) =>
    taskRepository.create({
      title,
      description,
      priority,
      status,
      projectId,
      assigneeId: savedUsers[assignee].id,
      dueDate: dateInDays(dueInDays),
    }),
  );
}

// FR7: a DONE task needs its DONE history entry, or the report's completion trend is empty
function addCompletions(historyRepository, { tasks, savedUsers }) {
  TASKS.forEach(({ assignee, completedDaysAgo }, index) => {
    if (completedDaysAgo === undefined) return;
    historyRepository.create({
      taskId: tasks[index].id,
      changedBy: savedUsers[assignee].id,
      oldStatus: TaskStatus.IN_PROGRESS,
      newStatus: TaskStatus.DONE,
      changedAt: `${dateInDays(-completedDaysAgo)}T15:00:00.000Z`,
    });
  });
}

/**
 * @param {string} [databasePath]
 * @returns {{ users: object, project: object, tasks: object[] }}
 * effects: replaces all data in the database with the demo data
 * modifies: every table
 */
function seed(databasePath = config.databasePath) {
  const db = createConnection(databasePath);
  try {
    clearTables(db);
    const users = addUsers(new UserRepository(db), new PasswordHasher());
    const project = addProject(new ProjectRepository(db), users);
    const tasks = addTasks(new TaskRepository(db), { projectId: project.id, savedUsers: users });
    addCompletions(new TaskStatusHistoryRepository(db), { tasks, savedUsers: users });
    return { users, project, tasks };
  } finally {
    db.close();
  }
}

/**
 * @param {string} [databasePath]
 * @returns {boolean} true if the demo data was loaded
 * effects: seeds only a database with no users (the first start of a deployed server)
 * modifies: every table, only when it was empty
 */
function seedIfEmpty(databasePath = config.databasePath) {
  const db = createConnection(databasePath);
  let isEmpty;
  try {
    isEmpty = new UserRepository(db).findAll().length === 0;
  } finally {
    db.close();
  }
  if (isEmpty) seed(databasePath);
  return isEmpty;
}

function printLogins({ project, tasks }) {
  console.log(`Seeded project ${project.id} "${project.name}" with ${tasks.length} tasks.`);
  console.log(`Every user's password: ${PASSWORD}`);
  console.table(
    USERS.map(({ name, email, role }) => ({ name, email, role: role ?? 'not in any project' })),
  );
}

// Runs only from the command line (npm run seed), not when another file requires it
if (require.main === module) printLogins(seed());

module.exports = { seed, seedIfEmpty, PASSWORD };
