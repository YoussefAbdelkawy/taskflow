# Architecture: how the Milestone 1 design maps to the code

Use this page when the evaluator asks "show me where your architecture is in the code".

## 1. Layered architecture

```
Client (browser in public/, Postman, Swagger UI at /api-docs)
  public/js/layout.js  the app shell (sidebar, topbar, theme) on every page
  public/js/ui.js      shared UI helpers (toasts, dialogs, loading / empty / error states)
  public/js/api.js     the only place that calls the backend; throws ApiError {status, message, details}
        │  HTTP + JSON, "Authorization: Bearer <token>"
        ▼
PRESENTATION   src/presentation/   routes → authenticate middleware → controllers → errorHandler
        │                          (also the Scheduler, which runs every minute)
        ▼
BUSINESS       src/business/       services (all rules), rules/ (Strategy), events/ (Observer), errors/
        │
        ▼
DATA ACCESS    src/data-access/    repositories (SQL only), database/ (schema, connection, seed)
        │
        ▼
SQLite file    data/taskflow.db

DOMAIN         src/domain/         enums and plain models, used by every layer
```

**Rule:** a layer only calls the layer directly below it. This is not just a convention: the
custom ESLint rule in `eslint.config.js` (`layers/no-forbidden-layer`) fails `npm run lint` if,
for example, a controller `require`s a repository.

| Layer        | Its only job                                                               | Example                                                        |
| ------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Presentation | Read `req`, call one service method, send JSON. No rules, no SQL.          | `src/presentation/controllers/TaskController.js`               |
| Business     | Validate, check permissions, apply rules, throw an `AppError` when broken. | `src/business/services/TaskService.js` (`changeStatus`)        |
| Data access  | Run SQL, convert rows ↔ objects. No rules.                                 | `src/data-access/repositories/TaskRepository.js` (`findTasks`) |
| Domain       | Shared vocabulary: `TaskStatus`, `Priority`, `Role`, `Frequency`, models.  | `src/domain/enums.js`                                          |

### One request, end to end (`PATCH /api/tasks/7/status`)

1. `src/presentation/routes/index.js` matches the URL; `authenticate` turns the bearer token into `req.user` (or 401).
2. `TaskController.changeStatus` passes `{ taskId, status, user }` to the service.
3. `TaskService.changeStatus` (`src/business/services/TaskService.js:129`) checks, in order: task exists (404) → user is assignee or manager (403) → valid status (400) → not blocked by a dependency (409).
4. It saves through `TaskRepository.update`, writes a history row through `TaskStatusHistoryRepository`, then publishes `TASK_STATUS_CHANGED` (and `TASK_COMPLETED` when DONE).
5. Observers react: `RecurrenceService` creates the next copy of a recurring task.
6. Any thrown `AppError` becomes the right HTTP status in `src/presentation/middleware/errorHandler.js` — controllers have no `try/catch`.

### The frontend (Milestone 3)

The frontend stays plain HTML + JavaScript in `public/` (no framework, no build step needed to run it), styled by one design system described in [DESIGN.md](../DESIGN.md):

- **Shell:** `layout.js` builds the sidebar and topbar on every page from `<header id="app-header">`, so no page copies navigation. Hooks for teammates: `taskflow:open-search` (Ctrl/Cmd K) and `taskflow:open-notifications` events.
- **Error contract:** every failed call throws `ApiError {status, message, details}`; status 0 means the server is unreachable; a 401 clears the token and opens `login.html?next=<page>`. Pages show `ui.errorState` or `ui.toast` with the server's message.
- **Styles:** `src/styles/app.css` (Tailwind 4 + Basecoat tokens) is built into `public/css/app.css` by `npm run build`. The built file is committed.

## 2. Design patterns from the class diagram

| Pattern                      | Where                                                                                                                                                           | Why we used it                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Layered architecture**     | `src/presentation`, `src/business`, `src/data-access`                                                                                                           | Separation of concerns; each layer can be tested alone                                                |
| **Repository**               | `src/data-access/repositories/*` extend `BaseRepository`                                                                                                        | Services never see SQL; unit tests swap in `InMemoryRepository`                                       |
| **Dependency injection**     | `src/container.js` (composition root) builds everything and passes it through constructors                                                                      | Loose coupling; tests inject fakes; no `new XRepository()` inside a service                           |
| **Observer**                 | `src/business/events/EventPublisher.js` (subject), `TaskObserver.js` (interface); `RecurrenceService` and `NotificationService` subscribe in `container.js:112` | `TaskService` announces "task completed / assigned" without knowing who cares (open/closed principle) |
| **Strategy**                 | `src/business/rules/recurrence/`: `RecurrenceStrategy` → `Daily`, `Weekly`, `MonthlyRecurrence`; picked by `strategyFor.js`                                     | Adding "yearly" = one new class + one table entry; no `if/else` chain in the service                  |
| **Builder** (FR7)            | `src/business/reports/ReportBuilder.js`, used by `ReportService.getProjectReport`                                                                               | Optional report sections assembled step by step; frozen result. See `docs/DESIGN_PATTERNS.md`         |
| **Strategy** (FR7 export)    | `src/business/reports/exporters/`: `CsvExporter`, `JsonExporter`, picked by `exporterFor.js`                                                                    | A new export format is one class + one table entry                                                    |
| **Command** (FR8)            | `public/js/board/commands.js`: `MoveTaskCommand` (`execute`/`undo`) and `CommandHistory`, used by `public/js/board/board.js`                                    | Drag, keyboard moves and Undo share one path: optimistic move, save, snap back and toast on failure   |
| **Template / abstract base** | `BaseRepository`, `RecurrenceStrategy`, `TaskObserver` throw "not implemented"                                                                                  | Defines the contract each subclass must fulfil                                                        |
| **Middleware chain**         | `authenticate.js`, `errorHandler.js`                                                                                                                            | Cross-cutting concerns (auth, errors) in one place, not repeated in each controller                   |

## 3. Programming paradigms (Milestone 2 requirement)

Every slice marks at least one **Imperative** and one **Declarative** block with a comment. Search
the code for `// Imperative:` and `// Declarative:` to list them all.

| Paradigm        | What it looks like here                                                                              | Best example to show                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Imperative      | Guard clauses in a fixed order, loops with counters, step-by-step processes                          | `TaskService.changeStatus`, `RecurrenceService.runDue` (the `for` loop)                                 |
| Declarative     | `filter` / `map` / `some` / `reduce`, SQL queries, lookup tables instead of `if/else`                | `RecurrenceService.runDue` (the `map/filter` chain), `DependencyService.isBlocked`                      |
| Functional      | Pure functions that never change their input; higher-order functions and closures                    | `src/business/rules/taskSorting.js` (sorts a copy); `createAuthenticate(authService)` returns a closure |
| Object-oriented | Classes, inheritance, polymorphism (`strategy.nextDueDate()`), encapsulation with `#private` methods | `DependencyService.#wouldCreateCycle`, the recurrence strategies                                        |

## 4. Non-functional requirements

| NFR               | How it is met                                                                                                                                                     | Proof                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Security          | Passwords hashed with scrypt + per-user salt, compared in constant time; every route after login needs a token; role checks in services                           | `PasswordHasher.js`, `AuthorizationService.js` |
| Performance       | Composite index `idx_tasks_filter` on `(assignee_id, priority, status, due_date)`                                                                                 | `tests/integration/filterPerformance.test.js`  |
| Data integrity    | `CHECK`, `UNIQUE`, foreign keys in `schema.sql`; cycle check + insert run in one transaction; `UNIQUE (recurrence_id, due_date)` stops duplicate recurring copies | `schema.sql`, `DependencyService.js:54`        |
| Reliability       | Scheduler catches its own errors so the server keeps running; one failing observer does not stop the others                                                       | `Scheduler.js`, `EventPublisher.publish`       |
| Performance (FR7) | Index `idx_tasks_project_due` on `(project_id, due_date)`; a report over 1,000 tasks in under 1 s (NFR7)                                                          | `tests/integration/reports.test.js`            |
| Maintainability   | ESLint (code smells + layer rule), Prettier, 480+ unit/integration tests, E2E tests, coverage gate, written test-first                                            | `npm run check`, `docs/TESTING.md`             |

## 5. API surface

31 endpoints, all under `/api`. Milestone 3 added `GET /api/projects/:id/report`, `GET /api/projects/:id/report.csv` and `GET /api/dashboard` (FR7), and `PATCH /api/tasks/:id` (edit a task, manager only, validated like create) and `DELETE /api/tasks/:id` (204; history, comments, notifications and dependency links go with it through `ON DELETE CASCADE`) (FR8). See them live at <http://localhost:3000/api-docs> (Swagger) or run
`docs/postman/TaskFlow.postman_collection.json`. `tests/integration/apiDocs.test.js` fails if a
route is added without being documented.
