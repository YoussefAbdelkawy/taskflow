/**
 * OpenAPI 3 description of every /api route, shown by Swagger UI at /api-docs.
 * tests/integration/apiDocs.test.js fails if a route in routes/index.js is missing here,
 * so add the route's entry in the same pull request that adds the route.
 */
const { TaskStatus, Priority, Role, Frequency, NotificationType } = require('../../domain/enums');

// Small builders so each endpoint below reads as one short block
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const reply = (description, schema) =>
  schema ? { description, ...json(schema) } : { description };
const error = (description) => reply(description, ref('Error'));
const body = (schema, example) => ({
  required: true,
  content: { 'application/json': { schema, example } },
});
const idParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'integer', example: 1 },
});
const queryEnum = (name, values, description) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema: { type: 'string', enum: values },
});

const taskId = idParam('id', 'Task id');
const projectId = idParam('projectId', 'Project id');
const notLoggedIn = error('Missing or invalid token');
const notAllowed = error('Logged in, but not allowed (not a member / not the manager)');
const notFound = error('No such resource');
// Checked before existence on purpose, so outsiders cannot learn which project ids exist
const notMemberOrNoProject = error('Not a member (or manager) of this project, or no such project');
const invalid = error('Invalid input');

const values = (enumObject) => Object.values(enumObject);

const schemas = {
  Error: {
    type: 'object',
    properties: { error: { type: 'string', example: 'Task 99 not found' } },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Mona' },
      email: { type: 'string', example: 'mona@taskflow.test' },
    },
  },
  LoginResult: {
    type: 'object',
    properties: { token: { type: 'string', format: 'uuid' }, user: ref('User') },
  },
  Project: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string', example: 'Website Relaunch' },
      description: { type: 'string' },
      startDate: { type: 'string', format: 'date' },
    },
  },
  Member: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      role: { type: 'string', enum: values(Role) },
    },
  },
  AddedMember: {
    type: 'object',
    properties: {
      userId: { type: 'integer' },
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string', enum: values(Role) },
    },
  },
  Task: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      projectId: { type: 'integer' },
      assigneeId: { type: 'integer' },
      recurrenceId: { type: 'integer', nullable: true },
      title: { type: 'string', example: 'Design the home page' },
      description: { type: 'string' },
      status: { type: 'string', enum: values(TaskStatus) },
      priority: { type: 'string', enum: values(Priority) },
      dueDate: { type: 'string', format: 'date' },
    },
  },
  StatusChange: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      taskId: { type: 'integer' },
      oldStatus: { type: 'string', enum: values(TaskStatus) },
      newStatus: { type: 'string', enum: values(TaskStatus) },
      changedBy: { type: 'integer' },
      changedByName: { type: 'string', example: 'Karim' },
      changedAt: { type: 'string', format: 'date-time' },
    },
  },
  Recurrence: {
    type: 'object',
    properties: {
      taskId: { type: 'integer' },
      frequency: { type: 'string', enum: values(Frequency), nullable: true },
      isActive: { type: 'boolean' },
    },
  },
  Dependencies: {
    type: 'object',
    properties: {
      prerequisites: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            projectId: { type: 'integer' },
            title: { type: 'string' },
            status: { type: 'string', enum: values(TaskStatus) },
          },
        },
      },
      isBlocked: { type: 'boolean', description: 'true while any prerequisite is not DONE' },
    },
  },
  Dependency: {
    type: 'object',
    properties: { taskId: { type: 'integer' }, dependsOnId: { type: 'integer' } },
  },
  Comment: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      taskId: { type: 'integer' },
      userId: { type: 'integer' },
      content: { type: 'string', example: 'Started work on this' },
      name: { type: 'string', description: "The author's name", example: 'Karim' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Notification: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      userId: { type: 'integer' },
      taskId: { type: 'integer' },
      type: { type: 'string', enum: values(NotificationType) },
      message: { type: 'string' },
      isRead: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
};

const list = (name) => ({ type: 'array', items: ref(name) });

const paths = {
  '/api/health': {
    get: {
      tags: ['Health'],
      summary: 'Is the server up?',
      security: [],
      responses: { 200: reply('Server is running', { type: 'object', example: { status: 'ok' } }) },
    },
  },

  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in and receive a token',
      description: 'Copy the token into the Authorize button (top right) to call the other routes.',
      security: [],
      requestBody: body(
        {
          type: 'object',
          required: ['email', 'password'],
          properties: { email: { type: 'string' }, password: { type: 'string' } },
        },
        { email: 'mona@taskflow.test', password: 'Password123!' },
      ),
      responses: {
        200: reply('Logged in', ref('LoginResult')),
        400: invalid,
        401: error('Wrong email or password'),
      },
    },
  },
  '/api/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Log out (the token stops working)',
      responses: { 204: reply('Logged out'), 401: notLoggedIn },
    },
  },
  '/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Who am I?',
      responses: { 200: reply('The logged-in user', ref('User')), 401: notLoggedIn },
    },
  },

  '/api/projects': {
    post: {
      tags: ['Projects'],
      summary: 'Create a project (the creator becomes its MANAGER)',
      requestBody: body(
        {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' }, description: { type: 'string' } },
        },
        { name: 'Postman Demo', description: 'Milestone 2 check' },
      ),
      responses: { 201: reply('Created', ref('Project')), 400: invalid, 401: notLoggedIn },
    },
    get: {
      tags: ['Projects'],
      summary: 'Projects I belong to',
      responses: { 200: reply('My projects', list('Project')), 401: notLoggedIn },
    },
  },
  '/api/projects/{id}': {
    get: {
      tags: ['Projects'],
      summary: 'One project (members only)',
      parameters: [idParam('id', 'Project id')],
      responses: {
        200: reply('The project', ref('Project')),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
  },
  '/api/projects/{id}/members': {
    post: {
      tags: ['Projects'],
      summary: 'Add a user to the project by email (manager only)',
      parameters: [idParam('id', 'Project id')],
      requestBody: body(
        {
          type: 'object',
          required: ['email', 'role'],
          properties: { email: { type: 'string' }, role: { type: 'string', enum: values(Role) } },
        },
        { email: 'karim@taskflow.test', role: 'MEMBER' },
      ),
      responses: {
        201: reply('Added', ref('AddedMember')),
        400: invalid,
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
        409: error('Already a member'),
      },
    },
  },
  '/api/projects/{projectId}/members': {
    get: {
      tags: ['Tasks (FR1)'],
      summary: 'Members who can be assigned a task (members only)',
      parameters: [projectId],
      responses: {
        200: reply('Members', list('Member')),
        401: notLoggedIn,
        403: notMemberOrNoProject,
      },
    },
  },
  '/api/projects/{projectId}/tasks': {
    post: {
      tags: ['Tasks (FR1)'],
      summary: 'Create and assign a task (manager only; starts as TO_DO)',
      parameters: [projectId],
      requestBody: body(
        {
          type: 'object',
          required: ['title', 'assigneeId', 'dueDate', 'priority'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            assigneeId: { type: 'integer' },
            dueDate: { type: 'string', format: 'date' },
            priority: { type: 'string', enum: values(Priority) },
          },
        },
        { title: 'Task A', assigneeId: 2, dueDate: '2030-01-01', priority: 'HIGH' },
      ),
      responses: {
        201: reply('Created; the assignee gets an ASSIGNED notification', ref('Task')),
        400: invalid,
        401: notLoggedIn,
        403: notMemberOrNoProject,
      },
    },
    get: {
      tags: ['Tasks (FR1)'],
      summary: "The project's tasks (members only)",
      parameters: [projectId],
      responses: {
        200: reply('Tasks', list('Task')),
        401: notLoggedIn,
        403: notMemberOrNoProject,
      },
    },
  },
  '/api/tasks/mine': {
    get: {
      tags: ['Tasks (FR1)'],
      summary: 'Tasks assigned to me',
      responses: { 200: reply('My tasks', list('Task')), 401: notLoggedIn },
    },
  },
  '/api/tasks/{id}': {
    get: {
      tags: ['Tasks (FR1)'],
      summary: 'One task (project members only)',
      parameters: [taskId],
      responses: {
        200: reply('The task', ref('Task')),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
  },
  '/api/tasks/{id}/status': {
    patch: {
      tags: ['Tasks (FR1)'],
      summary: 'Change status (assignee or manager); DONE triggers recurrence',
      parameters: [taskId],
      requestBody: body(
        {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: values(TaskStatus) } },
        },
        { status: 'IN_PROGRESS' },
      ),
      responses: {
        200: reply('Updated task', ref('Task')),
        400: invalid,
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
        409: error('Blocked by an unfinished dependency'),
      },
    },
  },
  '/api/tasks/{id}/history': {
    get: {
      tags: ['Tasks (FR1)'],
      summary: 'Status history with timestamps, oldest first',
      parameters: [taskId],
      responses: {
        200: reply('History', list('StatusChange')),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
  },

  '/api/tasks/{id}/recurrence': {
    get: {
      tags: ['Recurring tasks (FR2)'],
      summary: "The task's repeat rule",
      parameters: [taskId],
      responses: {
        200: reply('Rule', ref('Recurrence')),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
    put: {
      tags: ['Recurring tasks (FR2)'],
      summary: 'Make the task repeat (manager only)',
      parameters: [taskId],
      requestBody: body(
        {
          type: 'object',
          required: ['frequency'],
          properties: { frequency: { type: 'string', enum: values(Frequency) } },
        },
        { frequency: 'WEEKLY' },
      ),
      responses: {
        200: reply('Rule saved', ref('Recurrence')),
        400: invalid,
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
    delete: {
      tags: ['Recurring tasks (FR2)'],
      summary: 'Stop repeating (manager only)',
      parameters: [taskId],
      responses: {
        200: reply('Rule turned off', ref('Recurrence')),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
  },

  '/api/notifications': {
    get: {
      tags: ['Notifications (FR3)'],
      summary: 'My notifications, newest first',
      responses: { 200: reply('Notifications', list('Notification')), 401: notLoggedIn },
    },
  },
  '/api/notifications/unread-count': {
    get: {
      tags: ['Notifications (FR3)'],
      summary: 'Number for the bell icon',
      responses: {
        200: reply('Count', { type: 'object', example: { count: 1 } }),
        401: notLoggedIn,
      },
    },
  },
  '/api/notifications/{id}/read': {
    patch: {
      tags: ['Notifications (FR3)'],
      summary: 'Mark one of my notifications as read',
      parameters: [idParam('id', 'Notification id')],
      responses: {
        200: reply('Updated notification', ref('Notification')),
        401: notLoggedIn,
        403: error('Not your notification'),
        404: notFound,
      },
    },
  },

  '/api/tasks/{id}/comments': {
    post: {
      tags: ['Comments (FR4)'],
      summary: 'Comment on a task (project members only)',
      parameters: [taskId],
      requestBody: body(
        { type: 'object', required: ['content'], properties: { content: { type: 'string' } } },
        { content: 'Started work on this' },
      ),
      responses: {
        201: reply('Created', ref('Comment')),
        400: invalid,
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
    get: {
      tags: ['Comments (FR4)'],
      summary: "The task's comments, oldest first",
      parameters: [taskId],
      responses: {
        200: reply('Comments', list('Comment')),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
  },

  '/api/tasks': {
    get: {
      tags: ['Filter & sort (FR5)'],
      summary: 'My tasks, filtered and sorted by due date',
      parameters: [
        queryEnum('priority', values(Priority), 'Only this priority'),
        queryEnum('status', values(TaskStatus), 'Only this status'),
        queryEnum('sort', ['asc', 'desc'], 'Due date order (asc = earliest first)'),
      ],
      responses: { 200: reply('Tasks', list('Task')), 400: invalid, 401: notLoggedIn },
    },
  },

  '/api/tasks/{id}/dependencies': {
    post: {
      tags: ['Dependencies (FR6)'],
      summary: 'This task cannot start until dependsOnId is DONE (manager only)',
      parameters: [taskId],
      requestBody: body(
        {
          type: 'object',
          required: ['dependsOnId'],
          properties: { dependsOnId: { type: 'integer' } },
        },
        { dependsOnId: 1 },
      ),
      responses: {
        201: reply('Created', ref('Dependency')),
        400: error('Invalid input, or a task depending on itself'),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
        409: error('Dependency already exists, or it would create a cycle'),
      },
    },
    get: {
      tags: ['Dependencies (FR6)'],
      summary: 'Prerequisites and whether the task is blocked',
      parameters: [taskId],
      responses: {
        200: reply('Dependencies', ref('Dependencies')),
        401: notLoggedIn,
        403: notAllowed,
        404: notFound,
      },
    },
  },
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'TaskFlow API',
    version: '0.1.0',
    description:
      'Milestone 2 backend. Run `npm run seed` first; every seeded user has the password ' +
      '`Password123!` (mona@taskflow.test is a manager, karim@taskflow.test a member). ' +
      'Call POST /api/auth/login, then paste the token into **Authorize**. ' +
      'Every error is JSON `{ "error": "..." }`; a body over 100 KB is refused with 413.',
  },
  servers: [{ url: '/' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
    schemas,
  },
  paths,
};
