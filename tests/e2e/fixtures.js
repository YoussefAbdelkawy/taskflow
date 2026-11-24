// Shared E2E helpers: log in as a seeded user, and reset the database between spec files.
const path = require('node:path');
const os = require('node:os');
const { test: base, expect } = require('@playwright/test');
const { seed, PASSWORD } = require('../../src/data-access/database/seed');

const USERS = Object.freeze({
  mona: 'mona@taskflow.test', // manager of "Website Relaunch"
  karim: 'karim@taskflow.test', // member
  salma: 'salma@taskflow.test', // member
  hany: 'hany@taskflow.test', // in no project
});

// Same file scripts/e2e-server.js opened; the server reads it on every request
const resetDb = () => seed(path.join(os.tmpdir(), 'taskflow-e2e.db'));

/**
 * @param {import('@playwright/test').Page} page
 * @param {keyof USERS} who
 */
async function loginAs(page, who) {
  await page.goto('/login.html');
  await page.getByLabel('Email').fill(USERS[who]);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/index\.html$/);
}

module.exports = { test: base, expect, loginAs, resetDb, USERS, PASSWORD };
