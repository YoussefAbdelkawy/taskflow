// Starts TaskFlow for the E2E and API tests: a temporary database, seeded, on port 3100.
// Used by playwright.config.js (webServer) and scripts/api-tests.js.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const E2E_PORT = '3100';
const databasePath = path.join(os.tmpdir(), 'taskflow-e2e.db');
fs.rmSync(databasePath, { force: true });
process.env.DB_PATH = databasePath;
process.env.PORT = process.env.PORT || E2E_PORT;

// Read config only after DB_PATH and PORT are set
const { seed } = require('../src/data-access/database/seed');
const { createContainer } = require('../src/container');
const { createApp } = require('../src/app');
const config = require('../src/config');

seed(databasePath);
const app = createApp(createContainer({ databasePath }));
// The scheduler is left off so test data only changes when a test changes it
module.exports = app.listen(config.port, () => {
  console.log(`E2E server on http://localhost:${config.port} (database ${databasePath})`);
});
