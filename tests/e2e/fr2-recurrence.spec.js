// FR2 recurring tasks through the browser: the Repeats widget on task.html.
const { test, expect, loginAs, resetDb } = require('./fixtures');

test.beforeAll(resetDb);

test.describe('FR2 recurring tasks', () => {
  test('US2-1 a manager makes a task weekly, completes it and the next copy appears', async ({
    page,
  }) => {
    await loginAs(page, 'mona');
    await page.goto('/task.html?id=1'); // "Design the home page", due today
    const repeats = page.getByLabel('Repeats');
    await expect(page.locator('#recurrence-next')).toHaveText('Does not repeat');

    await repeats.selectOption('WEEKLY');

    await expect(page.locator('#recurrence-next')).toContainText('Next copy due');
    await expect(repeats).toHaveValue('WEEKLY');

    await page.getByRole('button', { name: 'Done' }).click();
    await page.goto('/project.html?id=1');
    await expect(page.locator('#task-list')).toContainText('Design the home page');
    const copies = page.locator('#task-list li', { hasText: 'Design the home page' });
    await expect(copies).toHaveCount(2);
  });

  test('US2-2 completing the same instance again does not create a second copy', async ({
    page,
  }) => {
    await loginAs(page, 'mona');
    await page.goto('/task.html?id=1'); // made weekly and completed in the test above
    await page.getByRole('button', { name: 'To Do' }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toBeEnabled();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();

    await page.goto('/project.html?id=1');
    await expect(page.locator('#task-list li', { hasText: 'Design the home page' })).toHaveCount(2);
  });

  test('US2-3 turning repeats off says "Does not repeat"', async ({ page }) => {
    await loginAs(page, 'mona');
    await page.goto('/task.html?id=2');
    await page.getByLabel('Repeats').selectOption('DAILY');
    await expect(page.locator('#recurrence-next')).toContainText('Next copy due');

    await page.getByLabel('Repeats').selectOption('');

    await expect(page.locator('#recurrence-next')).toHaveText('Does not repeat');
  });

  test('US2-1 a member sees the setting but the server refuses a change', async ({ page }) => {
    await loginAs(page, 'karim');
    await page.goto('/task.html?id=1');

    await page.getByLabel('Repeats').selectOption('MONTHLY');

    await expect(page.locator('.recurrence-message')).toContainText(/manager/i);
  });
});
