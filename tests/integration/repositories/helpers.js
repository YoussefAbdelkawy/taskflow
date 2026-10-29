// Shared setup for the repository integration tests: a fresh in-memory database
// with one user, one project and the four repositories.
const { createConnection } = require('../../../src/data-access/database/connection');
const UserRepository = require('../../../src/data-access/repositories/UserRepository');
const ProjectRepository = require('../../../src/data-access/repositories/ProjectRepository');
const TaskRepository = require('../../../src/data-access/repositories/TaskRepository');
const RecurrenceRuleRepository = require('../../../src/data-access/repositories/RecurrenceRuleRepository');

function createRepositories() {
  const db = createConnection(':memory:');
  return {
    db,
    users: new UserRepository(db),
    projects: new ProjectRepository(db),
    tasks: new TaskRepository(db),
    rules: new RecurrenceRuleRepository(db),
  };
}

const userData = (email = 'sara@taskflow.test') => ({
  name: 'Sara',
  email,
  passwordHash: 'salt:hash',
});

const projectData = () => ({ name: 'Website', description: 'Relaunch', startDate: '2026-10-01' });

const taskData = (overrides = {}) => ({
  projectId: 1,
  assigneeId: null,
  recurrenceId: null,
  title: 'Weekly report',
  description: 'Send the numbers',
  status: 'TO_DO',
  priority: 'MEDIUM',
  dueDate: '2026-11-02',
  ...overrides,
});

module.exports = { createRepositories, userData, projectData, taskData };
