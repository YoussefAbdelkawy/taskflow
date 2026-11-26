// FR1 task assignment and status through the browser (Milestone 2 behaviour, E2E added in M3
// so every FR1 story is traced to an end-to-end test).
const { test, expect, loginAs, resetDb } = require('./fixtures');

test.beforeAll(resetDb);

const properties = (page) => page.getByRole('complementary', { name: 'Task properties' });

test.describe('FR1 task assignment and status', () => {
  test('US1-1 a manager creates a task for Karim; it is To do and in Karim’s list', async ({
    page,
  }) => {
    await loginAs(page, 'mona');
    await page.goto('/project.html?id=1');
    await page.getByRole('button', { name: 'New task' }).click();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await dialog.getByLabel('Title').fill('Check the contact form');
    await dialog.getByLabel('Assignee').selectOption({ label: 'Karim' });
    await dialog.getByLabel('Due date').fill('2030-02-01');
    await dialog.getByLabel('Priority').selectOption('HIGH');
    await dialog.getByRole('button', { name: 'Create task' }).click();

    await expect(
      page
        .getByRole('region', { name: 'To do' })
        .getByRole('listitem')
        .filter({ hasText: 'Check the contact form' }),
    ).toBeVisible();

    await loginAs(page, 'karim');
    await page.goto('/my-tasks.html');
    await expect(page.locator('#my-task-list')).toContainText('Check the contact form');
  });

  test('US1-2 the assignee changes the status; the history shows old, new, who and when', async ({
    page,
  }) => {
    await loginAs(page, 'karim');
    await page.goto('/task.html?id=9'); // "Write the weekly report", Karim's, To do

    await properties(page).getByRole('button', { name: 'In progress' }).click();

    await expect(properties(page).getByRole('button', { name: 'In progress' })).toBeDisabled();
    const entry = page.locator('#history li').first();
    await expect(entry).toContainText('Karim');
    await expect(entry).toContainText('To do');
    await expect(entry).toContainText('In progress');
    await expect(entry.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
  });

  test('US1-3 a member who is neither assignee nor manager gets 403; the status is unchanged', async ({
    page,
  }) => {
    await loginAs(page, 'karim');
    await page.goto('/task.html?id=13'); // "Plan the user interviews", Salma's, To do

    await properties(page).getByRole('button', { name: 'Done' }).click();

    await expect(page.locator('#status-message')).toHaveText(
      'Only the assignee or a project manager can change the status',
    );
    await page.reload();
    await expect(properties(page).getByRole('button', { name: 'To do' })).toBeDisabled();
  });
});
