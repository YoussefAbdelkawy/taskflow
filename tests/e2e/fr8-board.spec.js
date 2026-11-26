// FR8 Kanban board on project.html through the browser: drag, Undo, blocked cards,
// keyboard moves (NFR8), the "New task" dialog and the tabs.
const { test, expect, loginAs, resetDb, PASSWORD } = require('./fixtures');

test.beforeAll(resetDb);

const column = (page, name) => page.getByRole('region', { name });
const card = (page, columnName, title) =>
  column(page, columnName).getByRole('listitem').filter({ hasText: title });
const announcer = (page) => page.locator('#board-announcer');

async function openBoard(page, who) {
  await loginAs(page, who);
  await page.goto('/project.html?id=1');
  await expect(column(page, 'To do').getByRole('listitem').first()).toBeVisible();
}

test.describe('FR8 Kanban board', () => {
  test('US8-1 the board is the default tab with To do, In progress and Done columns', async ({
    page,
  }) => {
    await openBoard(page, 'karim');

    await expect(page.getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true');
    await expect(card(page, 'To do', 'Design the home page')).toBeVisible();
    await expect(card(page, 'In progress', 'Write the API guide')).toBeVisible();
    await expect(card(page, 'Done', 'Set up the test server')).toBeVisible();
  });

  test('US8-1 the assignee drags a card to In progress; the move is saved', async ({ page }) => {
    await openBoard(page, 'karim');

    await card(page, 'To do', 'Design the home page').dragTo(column(page, 'In progress'));

    await expect(card(page, 'In progress', 'Design the home page')).toBeVisible();
    await expect(announcer(page)).toContainText('Design the home page moved to In progress');
    await page.reload();
    await expect(card(page, 'In progress', 'Design the home page')).toBeVisible();
  });

  test('US8-1 AC3 "Undo" in the toast restores the old status', async ({ page }) => {
    await openBoard(page, 'karim');

    await card(page, 'To do', 'Write the weekly report').dragTo(column(page, 'Done'));
    await expect(card(page, 'Done', 'Write the weekly report')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();

    await expect(card(page, 'To do', 'Write the weekly report')).toBeVisible();
    await page.reload();
    await expect(card(page, 'To do', 'Write the weekly report')).toBeVisible();
  });

  test('US8-1 AC1 a member who is not the assignee cannot move the card; it snaps back', async ({
    page,
  }) => {
    await openBoard(page, 'karim');

    await card(page, 'To do', 'Plan the user interviews').dragTo(column(page, 'In progress'));

    await expect(
      page.getByText('Only the assignee or a project manager can change the status'),
    ).toBeVisible();
    await expect(card(page, 'To do', 'Plan the user interviews')).toBeVisible();
  });

  test('US8-1 AC2 a blocked card shows "Blocked", snaps back and the toast names the blocker', async ({
    page,
    request,
  }) => {
    // "Prepare the launch email" (10) depends on "Fix the login bug" (3), which is not done
    const login = await request.post('/api/auth/login', {
      data: { email: 'mona@taskflow.test', password: PASSWORD },
    });
    const { token } = await login.json();
    const added = await request.post('/api/tasks/10/dependencies', {
      headers: { Authorization: `Bearer ${token}` },
      data: { dependsOnId: 3 },
    });
    expect(added.status()).toBe(201);

    await openBoard(page, 'mona');
    const blockedCard = card(page, 'To do', 'Prepare the launch email');
    await expect(blockedCard.getByText('Blocked')).toBeVisible();

    await blockedCard.dragTo(column(page, 'In progress'));

    await expect(page.getByText('Blocked by Fix the login bug')).toBeVisible();
    await expect(card(page, 'To do', 'Prepare the launch email')).toBeVisible();
  });

  test('NFR8 keyboard: Space picks up, → moves, Space drops, and the move is announced', async ({
    page,
  }) => {
    await openBoard(page, 'mona');
    const sprintPlan = card(page, 'To do', 'Review the sprint plan with the team');

    await sprintPlan.focus();
    await page.keyboard.press('Space');
    await expect(announcer(page)).toContainText('Picked up');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');

    await expect(card(page, 'In progress', 'Review the sprint plan with the team')).toBeVisible();
    await expect(announcer(page)).toContainText(
      'Review the sprint plan with the team moved to In progress',
    );
    await page.reload();
    await expect(card(page, 'In progress', 'Review the sprint plan with the team')).toBeVisible();
  });

  test('NFR8 keyboard: Esc cancels the move and nothing is saved', async ({ page }) => {
    await openBoard(page, 'mona');

    await card(page, 'In progress', 'Approve the launch budget').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');

    await expect(announcer(page)).toContainText('cancelled');
    await expect(card(page, 'In progress', 'Approve the launch budget')).toBeVisible();
    await page.reload();
    await expect(card(page, 'In progress', 'Approve the launch budget')).toBeVisible();
  });

  test('US8-1 a manager creates a task from the "New task" dialog; it appears in To do', async ({
    page,
  }) => {
    await openBoard(page, 'mona');

    await page.getByRole('button', { name: 'New task' }).click();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await dialog.getByLabel('Title').fill('Write the release notes');
    await dialog.getByLabel('Assignee').selectOption({ label: 'Karim' });
    await dialog.getByLabel('Due date').fill('2030-01-15');
    await dialog.getByLabel('Priority').selectOption('HIGH');
    await dialog.getByRole('button', { name: 'Create task' }).click();

    await expect(dialog).toBeHidden();
    await expect(card(page, 'To do', 'Write the release notes')).toBeVisible();
  });

  test('US8-1 a member does not see the "New task" button', async ({ page }) => {
    await openBoard(page, 'karim');

    await expect(page.getByRole('button', { name: 'New task' })).toHaveCount(0);
  });

  test('US8-1 the List, Activity and Settings tabs switch panels', async ({ page }) => {
    await openBoard(page, 'mona');

    await page.getByRole('tab', { name: 'List' }).click();
    await expect(page.locator('#task-list')).toBeVisible();
    await expect(page.locator('#task-list li', { hasText: 'Fix the login bug' })).toHaveCount(1);

    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.locator('#activity-panel')).toBeVisible();

    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.locator('#settings-panel')).toBeVisible();
  });

  test('US8-1 a user outside the project sees the server message instead of a board', async ({
    page,
  }) => {
    await loginAs(page, 'hany');
    await page.goto('/project.html?id=1');

    await expect(page.getByText(/Only project members/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
