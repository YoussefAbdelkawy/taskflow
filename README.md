# TaskFlow – Task and Project Management System

Software Construction & Testing, Winter 2026 — Team: Tony, Fady, Ali, Mostafa, Youssef, Nazmy.

A web app where project managers create projects, assign tasks with due dates, and track progress, while team members update status, comment, get notified, and see recurring tasks appear automatically.

## Tech stack (and why)

| Part         | Tool                                           | Why                                                                                 |
| ------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Language     | **JavaScript** (Node.js 22 LTS or newer)       | The labs teach JSDoc, `map`/`filter`/`reduce`, currying and `.bind()` in JavaScript |
| Backend      | **Express 5**                                  | Small, beginner-friendly web server                                                 |
| Database     | **SQLite** (built into Node: `node:sqlite`)    | Nothing to install, one file, real SQL                                              |
| Frontend     | Plain **HTML + CSS + JavaScript** in `public/` | No framework to learn                                                               |
| Tests        | **Jest** + **Supertest**                       | Unit and integration tests (TDD)                                                    |
| Code quality | **ESLint** + **Prettier**                      | Checks code smells from Lab 2 and our layer rule; formats code automatically        |

## Run it (first time)

1. Install **Node.js 22 LTS** (or newer) from <https://nodejs.org>. Check with `node -v`.
2. Install **Git** and **VS Code** (VS Code will suggest the ESLint and Prettier extensions; accept them).
3. In a terminal:

```bash
git clone <our-repo-url>
cd taskflow
npm install
npm start
```

4. Open <http://localhost:3000>. You should see **"Server status: ok"**.

## Everyday commands

| Command                 | What it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run dev`           | Starts the server and restarts it every time you save a file        |
| `npm test`              | Runs all tests                                                      |
| `npm run test:coverage` | Runs tests and shows how much code they cover                       |
| `npm run lint`          | Checks for code smells and layer-rule violations                    |
| `npm run lint:fix`      | Fixes what can be fixed automatically                               |
| `npm run format`        | Formats every file the same way                                     |
| `npm run check`         | lint + format check + tests. **Run this before every pull request** |

## Project structure (Layered architecture from Milestone 1)

```
public/                 Frontend: HTML pages, css/, js/ (api.js = the only place that calls the backend)
src/
  presentation/         TOP: controllers/, routes/, middleware/, scheduler/
  business/             MIDDLE: services/, rules/, events/, errors/
  data-access/          BOTTOM: database/ (connection, schema.sql, seed), repositories/
  domain/               Plain models used by every layer (Task, User, ...)
  container.js          Creates every object and connects them (dependency injection)
  app.js                Builds the Express app
  server.js             Starts it (npm start)
tests/
  unit/                 One test file per service / rule / repository
  integration/          Tests through the real app and database
  e2e/                  Full user journeys (Milestone 3)
```

**The one rule:** each layer only talks to the layer directly below it.
`presentation → business → data-access`. A controller never calls a repository. ESLint blocks it automatically.

Read **[CONVENTIONS.md](CONVENTIONS.md)** before writing your first line of code.
