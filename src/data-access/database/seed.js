// Demo data for the beta: `npm run seed`.
// Deletes every old row, then adds the users, one project and its tasks through the repositories.
const config = require('../../config');
const { createConnection } = require('./connection');
const UserRepository = require('../repositories/UserRepository');
const ProjectRepository = require('../repositories/ProjectRepository');
const TaskRepository = require('../repositories/TaskRepository');
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
  return TASKS.map(({ assignee, dueInDays, ...fields }) =>
    taskRepository.create({
      ...fields,
      projectId,
      assigneeId: savedUsers[assignee].id,
      dueDate: dateInDays(dueInDays),
    }),
  );
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
    return { users, project, tasks };
  } finally {
    db.close();
  }
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

module.exports = { seed, PASSWORD };
