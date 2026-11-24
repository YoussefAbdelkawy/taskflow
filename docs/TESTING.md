# Testing

How each testing technique from the labs is applied, where to find it, and how to run it.

| Command                 | What runs                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `npm test`              | Jest: unit and integration tests                                                        |
| `npm run test:coverage` | the same with coverage; fails under 95 % statements/functions/lines or 85 % branches    |
| `npm run check`         | lint + format check + `test:coverage`. Run before every pull request                    |
| `npm run test:e2e`      | Playwright end-to-end tests in Chromium (first time: `npx playwright install chromium`) |
| `npm run test:e2e:ui`   | the same in Playwright's UI mode, to watch a test run step by step                      |
| `npm run test:api`      | the Postman collection through Newman against a seeded server                           |
| `npm run trace`         | regenerates `docs/TRACEABILITY.md` and fails if a story is not covered                  |

## Techniques and where they are

| Technique                                      | Where                                                                                              | Example                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit testing**                               | `tests/unit/` (services with in-memory fakes, rules, the frontend helpers in a `vm` sandbox)       | `tests/unit/business/ReportService.test.js`, `tests/unit/public/ui.test.js`                                                                       |
| **Integration testing**                        | `tests/integration/` (Supertest through the real app and SQLite in memory)                         | `tests/integration/reports.test.js`                                                                                                               |
| **End-to-end testing**                         | `tests/e2e/*.spec.js` (Playwright drives Chromium against a seeded server on port 3100)            | `tests/e2e/fr7-reports.spec.js` downloads and parses the CSV                                                                                      |
| **Test-driven development**                    | every rule has a `test:` commit before its `feat:` commit                                          | `git log --oneline` (e.g. the FR7 report queries)                                                                                                 |
| **Equivalence partitioning + boundary values** | `it.each` tables with a comment naming the technique                                               | date range in `ReportService.test.js` (1 day, 366, 367, reversed, malformed); due dates in `ui.test.js`; CSV field classes in `exporters.test.js` |
| **Decision tables**                            | `it.each` over every combination of conditions                                                     | report access: manager / member / non-member × project exists or not (`ReportService.test.js`); traceability status (`traceability.test.js`)      |
| **Test doubles**                               | in-memory repositories, a fake report repository that records calls, a fixed clock, a fake `fetch` | `tests/unit/helpers/inMemoryRepositories.js`, `tests/unit/public/api.test.js`                                                                     |
| **Performance (NFR) tests**                    | timed integration tests on large data                                                              | `NFR7` in `tests/integration/reports.test.js` (1,000 tasks < 1 s); FR5 in `filterPerformance.test.js`                                             |
| **API / regression testing**                   | Postman collection with a test script on every request, run by Newman                              | `docs/postman/TaskFlow.postman_collection.json` (74 requests, 129 checks)                                                                         |
| **Regression in CI**                           | GitHub Actions runs every suite on each push and pull request                                      | `.github/workflows/ci.yml`                                                                                                                        |
| **Coverage**                                   | Jest thresholds in `jest.config.js`                                                                | `npm run test:coverage`                                                                                                                           |
| **Traceability**                               | story IDs in test titles → generated matrix                                                        | `docs/USER_STORIES.md` → `docs/TRACEABILITY.md`                                                                                                   |

## Writing a test so it counts

- Put the story ID at the start of the title: `it('US8-2 a member gets 403', …)`, `test('US8-1 drag a task to Done', …)`.
- E2E specs live in `tests/e2e/<fr>-<name>.spec.js` and use `loginAs(page, 'mona' | 'karim' | 'salma' | 'hany')` and `resetDb` from `tests/e2e/fixtures.js`. Call `test.beforeAll(resetDb)` at the top of each file.
- Seeded users: Mona (manager of project 1), Karim, Salma, Omar (members), Hany (in no project). Password `Password123!`.
