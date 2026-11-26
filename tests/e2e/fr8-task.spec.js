// FR8 on task.html through the browser: the two-column layout, the Edit dialog (US8-2) and
// Delete after confirming (US8-3).
const { test, expect, loginAs, resetDb } = require('./fixtures');

test.beforeAll(resetDb);

const properties = (page) => page.getByRole('complementary', { name: 'Task properties' });

async function openTask(page, who, id) {
  await loginAs(page, who);
  await page.goto(`/task.html?id=${id}`);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Loading…');
}

test.describe('FR8 task page', () => {
  test('US8-2 the page has a main column and a properties panel with the shared sections', async ({
    page,
  }) => {
    await openTask(page, 'mona', 1);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design the home page');
    await expect(properties(page)).toContainText('Karim'); // assignee
    await expect(properties(page)).toContainText('High'); // priority
    await expect(properties(page).locator('#recurrence')).toBeAttached();
    await expect(properties(page).locator('#dependencies')).toBeAttached();
    await expect(page.locator('#task-main #comments')).toBeAttached();
    await expect(page.locator('#task-main #task-activity')).toBeAttached();
  });

  test('US8-2 a manager edits title, priority and assignee in the dialog; it is saved', async ({
    page,
  }) => {
    await openTask(page, 'mona', 13); // "Plan the user interviews", Salma, High

    await page.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit task' });
    await expect(dialog.getByLabel('Title')).toHaveValue('Plan the user interviews');
    await dialog.getByLabel('Title').fill('Plan the customer interviews');
    await dialog.getByLabel('Priority').selectOption('LOW');
    await dialog.getByLabel('Assignee').selectOption({ label: 'Karim' });
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Plan the customer interviews',
    );
    await expect(properties(page)).toContainText('Karim');
    await expect(properties(page)).toContainText('Low');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Plan the customer interviews',
    );
  });

  test('US8-2 AC1 the server’s validation message is shown and the dialog stays open', async ({
    page,
  }) => {
    await openTask(page, 'mona', 13);

    await page.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit task' });
    await dialog.getByLabel('Title').fill('   ');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(dialog.getByText('Title is required')).toBeVisible();
    // still open (Basecoat draws the panel inside <dialog>, so check a control in it)
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeVisible();
  });

  test('US8-2 AC3 a member sees the task but no Edit or Delete button', async ({ page }) => {
    await openTask(page, 'karim', 1);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design the home page');
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });

  test('US8-3 Cancel in the confirm dialog keeps the task', async ({ page }) => {
    await openTask(page, 'mona', 11); // "Approve the launch budget"

    await page.getByRole('button', { name: 'Delete' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete "Approve the launch budget"?' });
    await confirm.getByRole('button', { name: 'Cancel' }).click();

    await expect(confirm).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Approve the launch budget');
  });

  test('US8-3 AC1 a manager deletes a task after a confirm that names it', async ({ page }) => {
    await openTask(page, 'mona', 12); // "Review the sprint plan with the team"

    await page.getByRole('button', { name: 'Delete' }).click();
    const confirm = page.getByRole('dialog', {
      name: 'Delete "Review the sprint plan with the team"?',
    });
    await expect(confirm).toContainText('comments and history are removed too');
    await confirm.getByRole('button', { name: 'Delete task' }).click();

    await expect(page).toHaveURL(/project\.html\?id=1$/);
    await expect(
      page.getByRole('region', { name: 'To do' }).getByRole('listitem').first(),
    ).toBeVisible();
    await expect(page.getByText('Review the sprint plan with the team')).toHaveCount(0);
  });

  test('US8-2 a user outside the project sees the server message with Try again', async ({
    page,
  }) => {
    await loginAs(page, 'hany');
    await page.goto('/task.html?id=1');

    // the page's own error box (the dependencies widget shows the same 403 in its panel)
    const errorBox = page.locator('#task-error');
    await expect(errorBox.getByText('Only project members can see this task')).toBeVisible();
    await expect(errorBox.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
