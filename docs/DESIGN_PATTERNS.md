# Design patterns

One section per pattern: the problem, the pattern, where it is in the code, why it beats the obvious alternative, and how to extend it. Milestone 3 asks for at least two patterns, implemented and justified; each member explains the pattern of their own FR in the discussion.

| Pattern                               | FR            | Owner                | Where                                   |
| ------------------------------------- | ------------- | -------------------- | --------------------------------------- |
| Repository                            | all           | team (Fady explains) | `src/data-access/repositories/`         |
| Dependency injection                  | all           | team                 | `src/container.js`                      |
| Observer                              | FR1, FR2, FR3 | team                 | `src/business/events/EventPublisher.js` |
| Strategy (recurrence)                 | FR2           | Youssef              | `src/business/rules/recurrence/`        |
| Builder (reports)                     | FR7           | Youssef              | `src/business/reports/ReportBuilder.js` |
| Strategy (export formats)             | FR7           | Youssef              | `src/business/reports/exporters/`       |
| Command                               | FR8           | Nazmy                | `public/js/board/commands.js`           |
| Observer subscriber `ActivityService` | FR9           | Ali                  | to do                                   |
| Facade                                | FR11          | Mostafa              | `SearchService` (to do)                 |
| Factory Method                        | FR12          | Tony                 | `NotificationFactory` (to do)           |

---

## Repository

- **Problem:** services must apply rules without knowing SQL, and unit tests must run without a database.
- **Pattern:** every table has a repository with the same five methods (`findById`, `findAll`, `create`, `update`, `delete`) from `BaseRepository`, plus its own queries.
- **Where:** `src/data-access/repositories/BaseRepository.js` (the contract), `TaskRepository.js`, `ProjectRepository.js`, …; `InMemoryRepository.js` for unit tests. FR7's `ReportRepository.js` is read-only, so it keeps only the query methods.
- **Why not SQL in the services:** a service would then depend on SQLite, every unit test would need a database, and the layer rule (`npm run lint`) would fail.
- **Extend:** a new table = one repository class, registered in `src/container.js`.

## Dependency injection

- **Problem:** objects need each other (a service needs repositories), but creating them inside each class couples everything together.
- **Pattern:** one composition root builds every object bottom-up and passes it through constructors.
- **Where:** `src/container.js`. Tests build services with in-memory fakes, e.g. `tests/unit/business/ReportService.test.js` passes a fake `reportRepository` and a fixed `clock`.
- **Why not `new TaskRepository()` inside a service:** the service could not be tested alone, and swapping the database would touch every service.
- **Extend:** add the new object to `createContainer` and pass it to whoever needs it.

## Observer

- **Problem:** when a task is assigned or completed, several features react (next recurring copy, notifications), but `TaskService` should not call each of them.
- **Pattern:** `TaskService` publishes events to `EventPublisher` (the subject); `RecurrenceService` and `NotificationService` subscribe as observers.
- **Where:** `src/business/events/EventPublisher.js`, `TaskObserver.js` (the interface); subscriptions in `src/container.js:123`.
- **Why not direct calls:** every new reaction would change `TaskService` (breaks open/closed), and one failing reaction could stop the task update. `EventPublisher.publish` isolates observers.
- **Extend:** write a class with `onTaskEvent(event)` and subscribe it in `container.js`. Ali's `ActivityService` (FR9) is the next one.

## Strategy: recurrence (FR2)

- **Problem:** daily, weekly and monthly tasks move their due date differently (months have different lengths).
- **Pattern:** `RecurrenceStrategy` declares `nextDueDate(dueDate)`; `DailyRecurrence`, `WeeklyRecurrence`, `MonthlyRecurrence` implement it; `strategyFor(frequency)` picks one from a lookup table.
- **Where:** `src/business/rules/recurrence/`, used by `RecurrenceService.generateNext` and `getRecurrence` (the next due date under the Repeats select).
- **Why not `if (frequency === 'DAILY') … else if …`:** the chain would sit in every method that needs a date, and each new frequency would edit all of them.
- **Extend:** "yearly" = one class and one line in `STRATEGIES`.

## Builder: project report (FR7)

- **Problem:** a report has a fixed core (project, date range) and several sections built from different queries (status breakdown, completion trend, workload, overdue). Some reports may skip sections, and the summary (total, completion rate, overdue count) must be derived from the sections after they exist.
- **Pattern:** `ReportBuilder` collects one section per `with…()` call and returns a deeply frozen report from `build()`.
- **Where:** `src/business/reports/ReportBuilder.js:26`; used in `ReportService.getProjectReport` (`src/business/services/ReportService.js:72`):

  ```js
  new ReportBuilder({ project, range })
    .withStatusBreakdown(rows)
    .withCompletionTrend(rows)
    .withWorkload(rows)
    .withOverdue(rows, today)
    .build();
  ```

- **Why not a constructor with eight arguments or one big function:** positional arguments are easy to swap by mistake, optional sections would need `null` placeholders and `if` checks, and the summary logic would be mixed with the queries. Each `with…()` step is small and unit-tested on its own (`tests/unit/business/reports/ReportBuilder.test.js`), sections left out stay empty, and the frozen result cannot be changed by the controller.
- **Extend:** a "by priority" section is one `withPriorityBreakdown(rows)` method and one repository query.

## Strategy: export formats (FR7)

- **Problem:** the same report is exported as CSV today and maybe JSON, PDF or Excel later; each format has its own content type, extension and encoding rules (CSV escaping per RFC 4180).
- **Pattern:** `ReportExporter` declares `export(report)`, `contentType` and `extension`; `CsvExporter` and `JsonExporter` implement it; `exporterFor(format)` picks one from a lookup table.
- **Where:** `src/business/reports/exporters/`; used by `ReportService.exportProjectReport`.
- **Why not a `switch (format)` in the service:** the service would grow with each format and mix escaping rules with access checks.
- **Extend:** a new format = one exporter class + one line in `EXPORTERS`; nothing else changes.

## Command (FR8, Nazmy)

- **Problem:** a card on the Kanban board can be moved three ways: drag-and-drop, the keyboard (NFR8: Space, ←/→, Space) and the toast's "Undo" (US8-1 AC3). Each move must show at once (optimistic update), save `PATCH /api/tasks/:id/status`, snap back with a toast when the server refuses (403, or 409 "Task is blocked", US8-1 AC2), and be undoable afterwards.
- **Pattern:** each move is an object that can do and undo itself. `MoveTaskCommand` stores `{ taskId, from, to }` and has `execute()` and `undo()`, which share one private `#moveTo(status, fallback)`: move the card, save, put it back and rethrow on failure. `CommandHistory` is the invoker: `run(command)` remembers a move only after the server accepted it, and `undo()` reverses the last one (it stays remembered if the undo itself fails, so Undo can be pressed again).
- **Where:** `public/js/board/commands.js` (the commands, no DOM); used by `public/js/board/board.js`, where drag (`drop` event), the keyboard (`drop()` after Space) and the toast's Undo all end in `history.run(new MoveTaskCommand(…))` or `history.undo()`. The board gives the command a `view` with `moveCard(taskId, status)` and the shared `api`.
- **Why not call the API in each handler:** drag, keyboard and Undo would each carry their own copy of "move, save, roll back, report", and the copies would drift (one forgets the snap-back, another the toast). Undo would also need to remember what changed by hand. With commands there is one tested path: `tests/unit/public/commands.test.js` checks execute, the 409 snap-back, undo, a failed undo and the history order with a fake api and a fake view, without a browser.
- **Extend:** a new kind of board action (for example "assign to me" or moving a card to another project) is one new class with `execute()` and `undo()`; `CommandHistory`, the toast's Undo and the keyboard handling work with it unchanged.

## Observer subscriber `ActivityService` (FR9, Ali)

To do.

## Facade (FR11, Mostafa)

To do.

## Factory Method (FR12, Tony)

To do.
