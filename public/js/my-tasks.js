/* global api */
// FR5 "My tasks" page: asks GET /api/tasks for the logged-in user's tasks with the chosen
// priority, status and sort order. Filtering and sorting happen on the server.
(() => {
  const form = document.getElementById('filter-form');
  const taskList = document.getElementById('my-task-list');
  const pageError = document.getElementById('my-tasks-error');
  const STATUS_LABELS = { TO_DO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
  const EMPTY_MESSAGE = 'No tasks found';

  function taskItem(task) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `task.html?id=${task.id}`;
    link.textContent = task.title; // textContent, so a title can never inject HTML
    item.append(link, ` · ${task.priority} · ${STATUS_LABELS[task.status]} · due ${task.dueDate}`);
    return item;
  }

  // "All" is an empty value, so it is left out of the query string
  function queryFor({ priority, status, sort }) {
    const params = new URLSearchParams({ sort: sort.value });
    if (priority.value) params.set('priority', priority.value);
    if (status.value) params.set('status', status.value);
    return params.toString();
  }

  async function showTasks() {
    pageError.textContent = '';
    try {
      const tasks = await api.get(`/tasks?${queryFor(form.elements)}`);
      // US5-3: an empty list is a normal result, not an error
      if (!tasks.length) {
        taskList.textContent = EMPTY_MESSAGE;
        return;
      }
      // Declarative: one <li> per task, in the order the server sorted them
      taskList.replaceChildren(...tasks.map(taskItem));
    } catch (error) {
      taskList.replaceChildren();
      pageError.textContent = error.message; // the server's text, e.g. "Sort must be asc or desc"
    }
  }

  form.addEventListener('change', showTasks);
  form.addEventListener('submit', (event) => event.preventDefault());
  showTasks();
})();
