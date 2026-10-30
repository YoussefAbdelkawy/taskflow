/* global api, layout */
// FR1 project page (project.html?id=<id>): lists the project's tasks and lets its manager
// create one. The server checks every permission; hiding the form is only for convenience.
(() => {
  const projectId = encodeURIComponent(new URLSearchParams(location.search).get('id'));
  const taskList = document.getElementById('task-list');
  const pageError = document.getElementById('project-error');
  const form = document.getElementById('new-task-form');
  const formMessage = document.getElementById('new-task-message');
  const STATUS_LABELS = { TO_DO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
  let members = [];

  const nameOf = (userId) => members.find((member) => member.id === userId)?.name ?? '—';

  function taskItem(task) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `task.html?id=${task.id}`;
    link.textContent = task.title;
    const details = ` · ${nameOf(task.assigneeId)} · ${task.priority} · ${STATUS_LABELS[task.status]} · due ${task.dueDate}`;
    item.append(link, details);
    return item;
  }

  async function showTasks() {
    const tasks = await api.get(`/projects/${projectId}/tasks`);
    if (!tasks.length) {
      taskList.textContent = 'No tasks yet';
      return;
    }
    // Declarative: one <li> per task
    taskList.replaceChildren(...tasks.map(taskItem));
  }

  function showForm(user) {
    const me = members.find((member) => member.id === user.id);
    if (me?.role !== 'MANAGER') return; // only managers may create tasks (NFR Security)
    form.elements.assigneeId.replaceChildren(
      ...members.map((member) => new Option(`${member.name} (${member.role})`, member.id)),
    );
    form.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = '';
    const { title, description, assigneeId, dueDate, priority } = form.elements;
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title: title.value.trim(),
        description: description.value.trim(),
        assigneeId: Number(assigneeId.value),
        dueDate: dueDate.value,
        priority: priority.value,
      });
      form.reset();
      await showTasks();
    } catch (error) {
      formMessage.textContent = error.message; // the server's text, e.g. "Title is required"
    }
  });

  async function load() {
    try {
      const user = await layout.userReady;
      members = await api.get(`/projects/${projectId}/members`);
      await showTasks();
      showForm(user);
    } catch (error) {
      pageError.textContent = error.message; // e.g. "Only project members can see its members"
    }
  }

  load();
})();
