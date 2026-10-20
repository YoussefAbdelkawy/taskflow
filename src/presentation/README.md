# Presentation layer (top)

What the user and the outside world talk to. **No business rules here.**

- `controllers/` – one controller per feature, e.g. `TaskController.js`. Reads the request, calls ONE service method, sends JSON back.
- `routes/` – maps URLs to controller methods (`routes/index.js`).
- `middleware/` – shared request handling, e.g. `errorHandler.js`.
- `scheduler/` – background jobs that run on a timer (Youssef: `Scheduler.js` for recurring tasks).

May import: `src/business`. Must NOT import: `src/data-access` (ESLint will stop you).
