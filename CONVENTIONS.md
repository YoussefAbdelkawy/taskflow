# Team conventions

Short version: **one feature = one controller + one service + one repository + tests, following the layers.**

## 1. The layer rule (most important)

```
Browser (public/)  →  Controller  →  Service  →  Repository  →  SQLite
                      presentation    business     data-access
```

- **Controllers never call repositories.** They call a service. ESLint (`npm run lint`) will show an error if you try.
- **Services never touch `req`/`res`.** They receive plain values, return plain values, and `throw` an error from `src/business/errors/AppError.js` when a rule is broken.
- **Repositories have no rules.** They only run SQL and return plain objects.
- Objects are created in **one place only**: `src/container.js`. Do not write `new TaskRepository()` inside a service; receive it in the constructor.

## 2. One feature = one vertical slice

For a feature called `Task`, you create:

| Layer        | File                                             | Job                                       |
| ------------ | ------------------------------------------------ | ----------------------------------------- |
| data-access  | `src/data-access/repositories/TaskRepository.js` | SQL for tasks (extends `BaseRepository`)  |
| business     | `src/business/services/TaskService.js`           | All the rules for tasks                   |
| presentation | `src/presentation/controllers/TaskController.js` | HTTP in, JSON out                         |
| presentation | a block in `src/presentation/routes/index.js`    | URLs                                      |
| wiring       | 3 lines in `src/container.js`                    | Connect repository → service → controller |
| frontend     | `public/tasks.html` + `public/js/tasks.js`       | The page                                  |
| tests        | `tests/unit/business/TaskService.test.js`        | Written **first** (TDD)                   |

**One service per feature.** Do not put comment logic inside `TaskService`; make a `CommentService`.

### Example of the whole slice

```js
// src/business/services/TaskService.js
const { ValidationError, NotFoundError } = require('../errors/AppError');

class TaskService {
  constructor({ taskRepository }) {
    this.taskRepository = taskRepository; // received, never created here
  }

  /**
   * @param {{ title: string, projectId: number }} input
   * @returns {object} the created task
   * requires: input.title is a non-empty string
   * effects: saves a new task with status TODO and returns it; throws ValidationError otherwise
   * modifies: the tasks table
   */
  createTask(input) {
    // Imperative: guard clauses, step by step (Lab 2: fail fast / return early)
    if (!input.title) throw new ValidationError('Title is required');
    if (!input.projectId) throw new ValidationError('Project is required');

    return this.taskRepository.create({ ...input, status: 'TODO' });
  }

  getTask(id) {
    const task = this.taskRepository.findById(id);
    if (!task) throw new NotFoundError(`Task ${id} not found`);
    return task;
  }
}
```

```js
// src/presentation/controllers/TaskController.js
class TaskController {
  constructor({ taskService }) {
    this.taskService = taskService;
  }

  create = (req, res) => {
    const task = this.taskService.createTask(req.body);
    res.status(201).json(task);
  };

  getById = (req, res) => {
    res.json(this.taskService.getTask(Number(req.params.id)));
  };
}
```

```js
// src/container.js (inside createContainer)
const repositories = { task: new TaskRepository(db) };
const services = { task: new TaskService({ taskRepository: repositories.task }) };
const controllers = {
  health: new HealthController(),
  task: new TaskController({ taskService: services.task }),
};

// src/presentation/routes/index.js
router.post('/tasks', controllers.task.create);
router.get('/tasks/:id', controllers.task.getById);
```

No `try/catch` needed in controllers: a thrown `ValidationError` automatically becomes HTTP 400 (see `middleware/errorHandler.js`).

## 3. Imperative + declarative (Milestone 2 requirement)

Every slice must contain **at least one of each**, and mark it with a comment so we can point at it during evaluation:

```js
// Imperative: validate the input step by step with guard clauses
// Declarative: filter + map + reduce to build the report
const doneCount = tasks.filter((task) => task.status === 'DONE').length;
```

- **Imperative** fits validation, status checks, the scheduler loop, step-by-step processes.
- **Declarative** fits lists, searching, counting, reports (`filter`/`map`/`reduce`), and SQL queries.
- Declarative helpers should be **pure functions** (same input → same output, no side effects, never change the input; Lab 3).

## 4. Naming

| What                      | Style                            | Example                                                    |
| ------------------------- | -------------------------------- | ---------------------------------------------------------- |
| Files containing a class  | PascalCase                       | `TaskService.js`, `TaskController.js`                      |
| Other files               | camelCase                        | `statusTransitions.js`, `api.js`                           |
| Classes                   | PascalCase + role suffix         | `TaskService`, `CommentRepository`, `WeeklyRule`           |
| Functions / variables     | camelCase, verb first            | `createTask`, `findByAssignee`, `isOverdue`                |
| Booleans                  | `is` / `has` / `can`             | `isDone`, `canAssign`                                      |
| Constants                 | UPPER_SNAKE_CASE                 | `MAX_TITLE_LENGTH`, `TaskStatus.IN_PROGRESS`               |
| Database tables / columns | snake_case, tables plural        | `tasks.due_date`                                           |
| URLs                      | plural nouns, kebab-case         | `POST /api/tasks`, `GET /api/projects/:id/progress-report` |
| Tests                     | `<File>.test.js`, sentence names | `it('rejects a task without a title')`                     |

## 5. Clean code checklist (Lab 2 + Lab 4)

- Return early / fail fast; no deep `if` nesting (ESLint warns at depth 3).
- More than 3 parameters? Pass one object instead (`createTask({ title, projectId, assigneeId })`).
- No magic numbers: give them a name (`const MAX_TITLE_LENGTH = 200`) or put them in `src/config.js`.
- No unnecessary `else` after `return`/`throw`.
- One function = one job. If its JSDoc needs "and", split it.
- Don't repeat yourself: shared code goes in a helper in `business/rules/`.
- Return results, don't `console.log` them.
- Every public service method gets JSDoc with `requires` / `effects` / `modifies`.

## 6. Tests first (TDD, needed for Milestone 3)

1. Write a failing test in `tests/unit/business/YourService.test.js` using an `InMemoryRepository`.
2. **Commit it** (`test: add failing test for task creation`).
3. Write the code until `npm test` passes, then **commit** (`feat: create tasks`).
4. Clean up the code, tests still green, **commit** (`refactor: ...`).

The git history then proves we worked test-first.

```js
const InMemoryRepository = require('../../../src/data-access/repositories/InMemoryRepository');
const TaskService = require('../../../src/business/services/TaskService');

it('rejects a task without a title', () => {
  const service = new TaskService({ taskRepository: new InMemoryRepository() });
  expect(() => service.createTask({ projectId: 1 })).toThrow('Title is required');
});
```

## 7. Git workflow

- **Never push directly to `main`.**
- One branch per task: `feature/<your-name>-<what>` → `feature/fady-status-workflow`.
- Commit messages start with a type: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
- Before opening a pull request: `git pull origin main`, then `npm run check` must pass.
- Every pull request needs **1 review** from a teammate before merging.
- Pull `main` every morning so you are working on the latest code.
