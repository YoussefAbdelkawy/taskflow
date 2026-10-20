# Business layer (middle)

All the rules of the system live here: who can assign a task, which status changes are allowed, when a recurring task is created.

- `services/` – one service per feature, e.g. `TaskService.js`. Receives its repositories in the constructor.
- `rules/` – small pure functions or Strategy classes, e.g. `statusTransitions.js`, `recurrence/WeeklyRule.js`.
- `events/` – the EventPublisher (Observer pattern) and event names (Mostafa).
- `errors/` – `AppError.js`: throw these when a rule is broken.

May import: `src/domain`, `src/business`. Must NOT import: `src/presentation`.
Uses repositories only through what is passed into the constructor, never with `require` + `new`.
