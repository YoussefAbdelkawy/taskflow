# Milestone 2 evaluation: checklist and question prep

## 1. Rubric → where we meet it

| Rubric item                           | Our evidence                                                                                                                      | Show it with                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Backend functionality                 | FR1–FR6 + login, 26 endpoints, 330+ passing tests                                                                                 | `npm test`                                                   |
| API demonstration (Postman / Swagger) | Postman collection: 69 requests, 118 checks. Swagger UI with "Try it out" on every endpoint                                       | Postman **Run collection**; <http://localhost:3000/api-docs> |
| Architecture alignment                | Layered architecture enforced by ESLint; Repository, DI, Observer, Strategy from the class diagram                                | [ARCHITECTURE.md](ARCHITECTURE.md), `npm run lint`           |
| Code quality & paradigms              | ESLint + Prettier clean; `// Imperative:` / `// Declarative:` markers in every slice; TDD history in git (`test:` before `feat:`) | `npm run check`, `git log --oneline`                         |
| Individual questions                  | Section 4 below                                                                                                                   | —                                                            |

## 2. Before you walk in (do this on the demo laptop the day before **and** 15 minutes before)

```bash
git pull
```

```bash
npm install
```

```bash
npm run check
```

Expected: lint clean, format clean, all tests pass.

```bash
npm run seed
```

```bash
npm start
```

Then open <http://localhost:3000/api-docs> and <http://localhost:3000>. Import the Postman collection in advance.

**Backup plan.** If Postman misbehaves, use Swagger (works offline, served from `node_modules`). If
a run leaves odd data, stop the server, `npm run seed`, `npm start` — 10 seconds. If the laptop
fails, any teammate's laptop with the repo works the same way.

## 3. Suggested 8-minute API demo

Use **Swagger** for the story (evaluators see the request and the response clearly), then finish with
the **Postman runner** to show every endpoint passing at once.

1. `GET /api/health` → `{ "status": "ok" }`. Then `GET /api/auth/me` with no token → **401** (security).
2. `POST /api/auth/login` as `mona@taskflow.test` / `Password123!` → copy the token → **Authorize**.
3. `POST /api/projects` → `POST /api/projects/{id}/members` (Karim) → `POST /api/projects/{projectId}/tasks` task A for Karim, HIGH.
4. `PUT /api/tasks/{A}/recurrence` `WEEKLY` (FR2). Create task B for Karim, then `POST /api/tasks/{B}/dependencies` with `dependsOnId` = A (FR6).
5. Log in as Karim (re-Authorize). `GET /api/notifications` → ASSIGNED (FR3). `PATCH /api/tasks/{B}/status` → **409 Task is blocked**.
6. `PATCH /api/tasks/{A}/status` IN_PROGRESS → DONE. `POST /api/tasks/{A}/comments` (FR4). `GET /api/tasks/{A}/history` shows timestamps.
7. `GET /api/tasks?priority=HIGH&sort=asc` (FR5) — next week's copy of A is there (FR2). `PATCH /api/tasks/{B}/status` now succeeds.
8. Show one error path: `GET /api/tasks?sort=sideways` → **400** with a clear message.
9. Postman: `npm run seed`, restart the server, then **Run collection** → 69 requests / 118 checks / 0 failed.

## 4. Individual questions (up to two each)

Everyone must be able to answer the **shared** questions. Then know your own section cold, and open
the files listed — evaluators usually say "show me in the code".

### Shared (anyone may be asked)

- **Explain the architecture.** Three layers + domain; each calls only the one below; ESLint enforces it (`eslint.config.js`). Walk one request through the layers (see ARCHITECTURE.md §1).
- **What is dependency injection, where is it?** `src/container.js` creates every object and passes dependencies into constructors. Services never `new` a repository, so tests can pass an in-memory one.
- **Why do controllers have no try/catch?** Services throw `AppError` subclasses (`src/business/errors/AppError.js`); Express 5 forwards thrown errors to `errorHandler.js`, which maps the error name to a status with a lookup table. Unexpected errors become a generic 500 so internals never leak; invalid JSON → 400 and a body over 100 KB → 413, both as JSON.
- **Imperative vs declarative — show one of each in your code.** Imperative = _how_, step by step (guard clauses, loops). Declarative = _what_ (`filter`/`map`/`some`, SQL). Grep for the markers.
- **How did you test it?** TDD: a failing `test:` commit, then the `feat:` commit. Unit tests use in-memory repositories; integration tests use Supertest on the real app with a `:memory:` SQLite database.

### Youssef — foundation, authentication, FR2 recurring tasks, integration

Files: `src/container.js`, `src/app.js`, `src/presentation/middleware/*`, `src/business/services/AuthService.js`, `src/data-access/security/PasswordHasher.js`, `src/business/rules/recurrence/*`, `src/business/services/RecurrenceService.js`, `src/presentation/scheduler/Scheduler.js`, `src/business/events/*`

- _How are passwords stored?_ scrypt with a random 16-byte salt per password, stored as `salt:hash`; verified with `crypto.timingSafeEqual` to avoid timing attacks. Login gives the same message for unknown email and wrong password so attackers cannot discover accounts.
- _How does a token work?_ Login returns a random UUID kept in `SessionRepository` (a `Map` token → userId). `authenticate` reads `Authorization: Bearer <token>` and sets `req.user`. Trade-off: sessions are lost on restart (acceptable for this milestone).
- _Explain the Strategy pattern in FR2._ `RecurrenceStrategy` defines `nextDueDate()`; Daily/Weekly/Monthly implement it; `strategyFor` picks one from a lookup table. Monthly clamps Jan 31 → Feb 28/29.
- _How do you avoid creating the same recurring task twice?_ Three guards: `lastGeneratedPeriod` on the rule, a lookup by `(recurrence_id, due_date)`, and a `UNIQUE (recurrence_id, due_date)` constraint as the final safety net (the duplicate error is caught and ignored).
- _Explain the Observer pattern._ `TaskService` publishes `TASK_COMPLETED`; `RecurrenceService` and `NotificationService` subscribed in `container.js`. TaskService does not know they exist, so new reactions need no change to it.

### Nazmy — FR1 task assignment and status

Files: `src/business/services/TaskService.js`, `src/business/services/AuthorizationService.js`, `src/presentation/controllers/TaskController.js`, `src/data-access/repositories/TaskStatusHistoryRepository.js`, `src/data-access/database/seed.js`

- _Who can create a task and who can change its status?_ Create: project managers only, and the assignee must be a project member. Status: the assignee or a manager (`#canChangeStatus`).
- _Walk through `changeStatus`._ Guard clauses in a fixed order — 404 → 403 → 400 → 409 (blocked) — then update, write a history row (old, new, who, when), publish events. Why that order: never reveal details to someone not allowed to see the task.
- _Why a separate `AuthorizationService`?_ The same "is manager / is member" checks are needed by tasks, projects, comments and dependencies; one place avoids duplicated rules.
- _Why is `/tasks/mine` registered before `/tasks/:id`?_ Express matches routes in order; otherwise "mine" would be read as an id.
- _Why does `GET /api/projects/999/tasks` answer 403, not 404?_ The membership check runs first. A non-member gets the same answer whether the project exists or not, so outsiders cannot discover which projects exist.

### Mostafa — FR5 filter and sort

Files: `src/business/rules/taskSorting.js`, `TaskService.getTasks` (`TaskService.js:228`), `TaskRepository.findTasks` (`TaskRepository.js:81`), `src/data-access/database/schema.sql` (`idx_tasks_filter`), `public/my-tasks.html`

- _Why is `sortByDueDate` a pure function?_ Same input → same output, no side effects, sorts a copy (`[...tasks]`) so the caller's array never changes. Easy to unit test without a database. Ties are broken by id so the order is stable.
- _Where does filtering happen and why?_ In SQL (`findTasks` builds `WHERE` only for filters that have a value — declarative), so the database does the work with the index. Invalid values (e.g. `URGENT`) are rejected in the service with 400.
- _How did you meet the performance NFR?_ Composite index `(assignee_id, priority, status, due_date)` matching the query; `filterPerformance.test.js` checks 500 tasks.
- _How is SQL injection prevented?_ Only known column names are used and values are bound as `?` parameters, never concatenated.

### Fady — projects and FR4 comments

Files: `src/business/services/ProjectService.js`, `src/business/services/CommentService.js`, their controllers and repositories

- _What happens when a project is created?_ Validate name/description, save the project, then add the creator as `MANAGER` — so every project always has a manager.
- _Adding a member: what can go wrong?_ Project missing (404), caller not a manager (403), invalid role or empty email (400), unknown user (404), already a member (409). Guard clauses in that order.
- _Who can read and write comments?_ Only members of the task's project (`AuthorizationService.isMember`); comments come back oldest first with the author's name; empty content → 400.

### Tony — FR3 notifications

Files: `src/business/services/NotificationService.js`, `src/data-access/repositories/NotificationRepository.js`, `src/presentation/controllers/NotificationController.js`, `src/presentation/scheduler/Scheduler.js`

- _What triggers each notification type?_ ASSIGNED: the Observer event `TASK_ASSIGNED`, instantly. DUE_SOON / OVERDUE: the Scheduler calls `sendReminders(now)` every minute and on startup.
- _How do you avoid spamming the same alert?_ `#notifyOnce` checks `exists({ userId, taskId, type })` first. Overdue goes to the assignee and every manager, collected in a `Set` so nobody gets it twice.
- _Can I mark someone else's notification as read?_ No — 404 if it does not exist, 403 if it is not yours.

### Ali — FR6 task dependencies

Files: `src/business/services/DependencyService.js`, `src/data-access/repositories/TaskDependencyRepository.js`, `src/presentation/controllers/DependencyController.js`

- _How do you detect a cycle?_ Before adding "B depends on A", walk from A through its own prerequisites (depth-first, with a `visited` set). If the walk reaches B, the new edge would close a loop → 409 `Circular dependency`.
- _Why run the check inside a transaction?_ So the check and the insert happen as one unit; two requests at the same time cannot both pass the check and create a cycle (NFR data integrity).
- _What does "blocked" mean?_ At least one prerequisite is not DONE (`isBlocked` uses `.some` — declarative). `TaskService` asks this before moving a task to IN_PROGRESS or DONE and answers 409.
- _Other rules?_ Self-dependency → 400 (also a `CHECK` in SQL); both tasks must be in the same project; duplicates → 409; only managers add dependencies.
