// Logging in and out through the real browser.
const { test, expect, loginAs, resetDb } = require('./fixtures');

test.beforeAll(resetDb);

test.describe('authentication', () => {
  test('a user logs in and lands on the dashboard with their name', async ({ page }) => {
    await loginAs(page, 'karim');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Karim');
    await expect(page.locator('#status')).toHaveText('all systems normal');
  });

  test('a wrong password shows the server message and stays on the login page', async ({
    page,
  }) => {
    await page.goto('/login.html');
    await page.getByLabel('Email').fill('karim@taskflow.test');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('#login-error')).toHaveText('Wrong email or password');
    await expect(page).toHaveURL(/login\.html/);
  });

  test('empty fields are flagged before anything is sent', async ({ page }) => {
    await page.goto('/login.html');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('#email-error')).toHaveText('Enter your email address');
    await expect(page.locator('#password-error')).toHaveText('Enter your password');
  });

  test('logging out from the user menu returns to the login page', async ({ page }) => {
    await loginAs(page, 'karim');
    await page.locator('#user-menu-trigger').click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/login\.html/);
    await page.goto('/index.html');
    await expect(page).toHaveURL(/login\.html\?next=index\.html/);
  });

  test('a page opened without a login returns there after logging in (401 keeps next)', async ({
    page,
  }) => {
    await page.goto('/task.html?id=1');
    await expect(page).toHaveURL(/login\.html\?next=task\.html%3Fid%3D1/);

    await page.getByLabel('Email').fill('karim@taskflow.test');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/task\.html\?id=1$/);
  });
});
