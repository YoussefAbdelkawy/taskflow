// FR1 pages are served with the shared header, the right elements and their scripts in order.
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

describe('FR1 pages', () => {
  const app = createApp(createContainer({ databasePath: ':memory:' }));

  it('project.html has the header, a task list, the "New task" form and its scripts in order', async () => {
    const { status, text } = await request(app).get('/project.html');

    expect(status).toBe(200);
    expect(text).toContain('<header id="app-header"></header>');
    expect(text).toContain('id="task-list"');
    expect(text).toContain('id="new-task-form"');
    for (const field of [
      'name="title"',
      'name="assigneeId"',
      'name="dueDate"',
      'name="priority"',
    ]) {
      expect(text).toContain(field);
    }
    expect(loadsInOrder(text, ['js/api.js', 'js/layout.js', 'js/project.js'])).toBe(true);
  });

  it('task.html has the header, details, status buttons, history and the shared sections', async () => {
    const { status, text } = await request(app).get('/task.html');

    expect(status).toBe(200);
    expect(text).toContain('<header id="app-header"></header>');
    expect(text).toContain('id="task-details"');
    expect(text).toContain('id="status-buttons"');
    expect(text).toContain('id="history"');
    expect(text).toContain('<section id="recurrence"');
    // Ali (FR6) and Fady (FR4) fill these; they stay empty in turn 2
    expect(text).toContain('<section id="dependencies"></section>');
    expect(text).toContain('<section id="comments"></section>');
  });

  it('task.html loads api.js, layout.js, task.js and Youssef’s recurrence.js in order', async () => {
    const { text } = await request(app).get('/task.html');

    expect(
      loadsInOrder(text, ['js/api.js', 'js/layout.js', 'js/task.js', 'js/recurrence.js']),
    ).toBe(true);
  });

  it('index.html links to the seeded project', async () => {
    const { text } = await request(app).get('/index.html');

    expect(text).toContain('href="project.html?id=1"');
  });

  it.each(['/js/project.js', '/js/task.js'])('serves %s', async (url) => {
    expect((await request(app).get(url)).status).toBe(200);
  });
});
