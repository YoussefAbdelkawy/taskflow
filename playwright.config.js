// End-to-end tests (Playwright): npm run test:e2e. First time only: npx playwright install chromium
// The tests start their own server on port 3100 with a fresh, seeded database (scripts/e2e-server.js),
// so they never touch data/taskflow.db.
const { defineConfig, devices } = require('@playwright/test');

const PORT = 3100;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false, // one shared database, re-seeded per file
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node --disable-warning=ExperimentalWarning scripts/e2e-server.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
