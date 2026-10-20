# Data access layer (bottom)

Stores and loads data. **No rules, no HTTP.** Just SQL in, objects out.

- `database/connection.js` – opens SQLite and runs `schema.sql`.
- `database/schema.sql` – all tables (Nazmy).
- `database/seed.js` – sample data for the demo (Nazmy).
- `repositories/BaseRepository.js` – the contract every repository follows.
- `repositories/InMemoryRepository.js` – fake repository for unit tests.
- `repositories/TaskRepository.js` etc. – the real ones (Ali).

Must NOT import: `src/presentation`, `src/business`.
