// FR7 reports and dashboard through the browser.
const fs = require('node:fs');
const { test, expect, loginAs, resetDb } = require('./fixtures');

test.beforeAll(resetDb);

test.describe('FR7 reports and dashboard', () => {
  test('US7-1 a manager opens the report and sees stats, charts and the overdue table', async ({
    page,
  }) => {
    await loginAs(page, 'mona');
    await page.getByRole('link', { name: 'Reports' }).click();

    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.locator('[data-summary="total"]')).not.toHaveText('–');
    await expect(page.locator('#overdue-table tbody')).toContainText('Fix the login bug');
    await expect(page.locator('#chart-status')).toBeVisible();
    await expect(page).toHaveURL(/project=1/); // the choice is kept in the URL
  });

  test('US7-1 a reversed date range shows the server error', async ({ page }) => {
    await loginAs(page, 'mona');
    await page.goto('/reports.html');
    await page.getByLabel('From', { exact: true }).fill('2026-12-31');
    await page.getByLabel('To', { exact: true }).fill('2026-01-01');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.locator('#report-message')).toContainText('on or before');
  });

  test('US7-1 a member sees that reports are for project managers', async ({ page }) => {
    await loginAs(page, 'karim');
    await page.goto('/reports.html');

    await expect(page.getByText('Reports are for project managers')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0); // not in the sidebar
  });

  test('US7-2 Export CSV downloads taskflow-<project>-<date>.csv with the overdue rows', async ({
    page,
  }) => {
    await loginAs(page, 'mona');
    await page.goto('/reports.html');
    await expect(page.locator('#export-csv')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-csv').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      /^taskflow-website-relaunch-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const lines = fs
      .readFileSync(await download.path(), 'utf8')
      .trim()
      .split('\r\n');
    expect(lines[0]).toBe('ID,Title,Assignee,Priority,Status,Due date,Days late');
    expect(lines.some((line) => line.includes('Fix the login bug,Omar,HIGH'))).toBe(true);
  });

  test('US7-3 the dashboard shows my counts and my next tasks, earliest first', async ({
    page,
  }) => {
    await loginAs(page, 'karim');

    await expect(page.locator('[data-stat="open"]')).toHaveText('2');
    await expect(page.locator('[data-stat="done"]')).toHaveText('2');
    const rows = page.locator('#due-soon a');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Design the home page');
    await expect(page.locator('#project-progress')).toContainText('Website Relaunch');
  });

  test('US7-3 the theme switch turns on dark mode and remembers it', async ({ page }) => {
    await loginAs(page, 'karim');
    await page.locator('#user-menu-trigger').click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();

    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
