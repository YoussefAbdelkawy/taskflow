// M3 design system: every page uses the shared stylesheet, theme script and shell,
// and Joe's new pages (dashboard, reports, style guide) are served with their parts.
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const PUBLIC = path.join(__dirname, '../../public');
const PAGES = fs.readdirSync(PUBLIC).filter((file) => file.endsWith('.html'));
const APP_PAGES = PAGES.filter((file) => !['login.html', 'styleguide.html'].includes(file));

const loadsInOrder = (text, scripts) => {
  const positions = scripts.map((src) => text.indexOf(`src="${src}"`));
  return (
    positions.every((position) => position > 0) &&
    positions.join() === [...positions].sort((a, b) => a - b).join()
  );
};

describe('design system pages', () => {
  const app = createApp(createContainer({ databasePath: ':memory:' }));

  it.each(PAGES)('%s links css/app.css and applies the theme before painting', async (page) => {
    const { status, text } = await request(app).get(`/${page}`);

    expect(status).toBe(200);
    expect(text).toContain('href="css/app.css"');
    expect(text.indexOf('js/theme.js')).toBeLessThan(text.indexOf('css/app.css'));
    expect(text).not.toContain('css/style.css');
    expect(text).not.toMatch(/(src|href)="https?:\/\//); // works offline on the demo laptop
  });

  it.each(APP_PAGES)(
    '%s loads api.js, ui.js and layout.js in order (the shared shell)',
    async (page) => {
      const { text } = await request(app).get(`/${page}`);

      expect(text).toContain('<header id="app-header"></header>');
      expect(loadsInOrder(text, ['js/api.js', 'js/ui.js', 'js/layout.js'])).toBe(true);
    },
  );

  it.each([
    'vendor/basecoat.min.js',
    'vendor/lucide.svg',
    'vendor/chart.umd.min.js',
    'vendor/basecoat-chart.min.js',
    'css/files/geist-latin-wght-normal.woff2',
    'js/theme.js',
    'js/ui.js',
  ])('serves the built asset %s (committed, no build step needed)', async (file) => {
    expect((await request(app).get(`/${file}`)).status).toBe(200);
  });

  it('US7-3 index.html is the dashboard: greeting, stats, due soon, project progress, status', async () => {
    const { text } = await request(app).get('/index.html');

    for (const id of ['welcome', 'stats', 'due-soon', 'project-progress', 'status']) {
      expect(text).toContain(`id="${id}"`);
    }
    expect(loadsInOrder(text, ['js/api.js', 'js/ui.js', 'js/layout.js', 'js/app.js'])).toBe(true);
  });

  it('US7-1 reports.html has the project select, date range, charts, overdue table and export', async () => {
    const { status, text } = await request(app).get('/reports.html');

    expect(status).toBe(200);
    for (const id of [
      'report-form',
      'report-project',
      'report-from',
      'report-to',
      'report-stats',
      'chart-status',
      'chart-trend',
      'chart-workload',
      'overdue-table',
      'export-csv',
    ]) {
      expect(text).toContain(`id="${id}"`);
    }
    expect(
      loadsInOrder(text, [
        'vendor/chart.umd.min.js',
        'vendor/basecoat-chart.min.js',
        'js/api.js',
        'js/ui.js',
        'js/layout.js',
        'js/reports.js',
      ]),
    ).toBe(true);
  });

  it('login.html keeps the form ids and has the demo-account hint', async () => {
    const { text } = await request(app).get('/login.html');

    expect(text).toContain('id="login-form"');
    expect(text).toContain('id="login-error"');
    expect(text).toContain('mona@taskflow.test');
    expect(text).not.toContain('<header id="app-header">'); // no shell on the login page
  });

  it('styleguide.html shows every shared component', async () => {
    const { text } = await request(app).get('/styleguide.html');

    for (const section of [
      'Buttons',
      'Badges',
      'Status',
      'Form fields',
      'Dialog',
      'Table',
      'Empty state',
      'Loading',
      'Alert',
      'Toast',
      'Tabs',
      'Progress',
    ]) {
      expect(text).toContain(`<h2 class="font-medium">${section}</h2>`);
    }
  });
});
