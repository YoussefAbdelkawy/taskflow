// FR5 page: my-tasks.html is served with the shared header, the filter controls,
// the result list and its scripts in order.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

// true if every script appears in the page, in this order
const loadsInOrder = (text, scripts) => {
  const positions = scripts.map((src) => text.indexOf(`src="${src}"`));
  return (
    positions.every((position) => position > 0) &&
    positions.join() === [...positions].sort((a, b) => a - b).join()
  );
};

describe('FR5 page', () => {
  const app = createApp(createContainer({ databasePath: ':memory:' }));

  it('my-tasks.html has the header, the priority/status/sort controls and the task list', async () => {
    const { status, text } = await request(app).get('/my-tasks.html');

    expect(status).toBe(200);
    expect(text).toContain('<header id="app-header"></header>');
    expect(text).toContain('id="filter-form"');
    expect(text).toContain('id="my-task-list"');
    for (const control of ['name="priority"', 'name="status"', 'name="sort"']) {
      expect(text).toContain(control);
    }
  });

  it('offers every priority and status, plus "All" (empty value)', async () => {
    const { text } = await request(app).get('/my-tasks.html');

    for (const value of ['HIGH', 'MEDIUM', 'LOW', 'TO_DO', 'IN_PROGRESS', 'DONE', 'asc', 'desc']) {
      expect(text).toContain(`value="${value}"`);
    }
    expect(text).toContain('value=""');
  });

  it('loads api.js, layout.js and my-tasks.js in order', async () => {
    const { text } = await request(app).get('/my-tasks.html');

    expect(loadsInOrder(text, ['js/api.js', 'js/layout.js', 'js/my-tasks.js'])).toBe(true);
  });

  it('serves /js/my-tasks.js, which shows "No tasks found" for an empty list (US5-3)', async () => {
    const { status, text } = await request(app).get('/js/my-tasks.js');

    expect(status).toBe(200);
    expect(text).toContain('No tasks found');
  });
});
