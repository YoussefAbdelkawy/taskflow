/* global api, layout, ui, kanban */
// FR8 project page (project.html?id=<id>): the Board tab (js/board/board.js), the List tab and
// the "New task" dialog for managers. The server checks every permission; hiding the button
// for members is only for convenience.
(() => {
  const projectId = encodeURIComponent(new URLSearchParams(location.search).get('id'));
  const body = document.getElementById('project-body');
  const errorBox = document.getElementById('project-error');
  const boardContainer = document.getElementById('board');
  const projectName = document.getElementById('project-name');
  const taskList = document.getElementById('task-list');
  const newTaskButton = document.getElementById('new-task');
  const dialog = document.getElementById('new-task-dialog');
  const form = document.getElementById('new-task-form');
  const formMessage = document.getElementById('new-task-message');
  const board = kanban.mount({
    container: boardContainer,
    announcer: document.getElementById('board-announcer'),
    api,
  });
  let members = [];

  const nameOf = (userId) => members.find((member) => member.id === userId)?.name ?? '';

  function listRow(task) {
    const due = ui.formatDue(task.dueDate, undefined, { isDone: task.status === 'DONE' });
    return ui.el(
      'li',
      {},
      ui.el(
        'a',
        { className: 'row-link', attrs: { href: `task.html?id=${task.id}` } },
        ui.statusDot(task.status),
        ui.el('span', {
          className: 'w-14 font-mono text-xs text-muted-foreground',
          text: `TF-${task.id}`,
        }),
        ui.el('span', { className: 'min-w-0 flex-1 truncate', text: task.title }), // text, never innerHTML
        ui.priorityBadge(task.priority),
        ui.el('span', {
          className: `w-16 text-right text-xs ${due.isLate ? 'text-status-blocked' : 'text-muted-foreground'}`,
          text: due.text,
        }),
        ui.avatar(nameOf(task.assigneeId)),
      ),
    );
  }

  // Which tasks each task depends on, for the "Blocked" badges and the 409 toast
  async function prerequisitesOf(tasks) {
    const answers = await Promise.all(
      tasks.map((task) => api.get(`/tasks/${task.id}/dependencies`)),
    );
    // Declarative: task id → the ids of its prerequisites
    return new Map(
      tasks.map((task, i) => [task.id, answers[i].prerequisites.map((item) => item.id)]),
    );
  }

  function showEmpty(isManager) {
    const action = isManager
      ? ui.el('button', {
          className: 'btn',
          text: 'New task',
          attrs: { type: 'button', 'data-size': 'sm' },
        })
      : null;
    action?.addEventListener('click', openDialog);
    ui.empty(boardContainer, {
      icon: 'list-todo',
      title: 'No tasks yet',
      body: isManager
        ? 'Create the first task for this project.'
        : 'The project manager has not added any tasks yet.',
      action,
    });
    taskList.replaceChildren();
  }

  function showError(error) {
    projectName.textContent = 'Project';
    body.hidden = true;
    errorBox.hidden = false;
    ui.errorState(errorBox, error, load); // the server's message + "Try again"
  }

  async function load() {
    errorBox.hidden = true;
    body.hidden = false;
    ui.skeletonRows(boardContainer); // 1. loading
    try {
      const user = await layout.userReady;
      const [project, team, tasks] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/members`),
        api.get(`/projects/${projectId}/tasks`),
      ]);
      members = team;
      projectName.textContent = project.name;
      document.title = `${project.name} – TaskFlow`;
      const isManager = members.find((member) => member.id === user.id)?.role === 'MANAGER';
      newTaskButton.hidden = !isManager;
      if (tasks.length === 0) {
        showEmpty(isManager); // 2. empty
        return;
      }
      board.render(tasks, { prerequisitesOf: await prerequisitesOf(tasks), nameOf }); // 3. success
      taskList.replaceChildren(...tasks.map(listRow));
    } catch (error) {
      showError(error); // 4. error
    }
  }

  function openDialog() {
    form.reset();
    formMessage.textContent = '';
    form.elements.assigneeId.replaceChildren(
      ...members.map((member) => new Option(member.name, member.id)),
    );
    dialog.showModal();
    form.elements.title.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = '';
    const { title, description, assigneeId, dueDate, priority } = form.elements;
    try {
      const task = await api.post(`/projects/${projectId}/tasks`, {
        title: title.value.trim(),
        description: description.value.trim(),
        assigneeId: Number(assigneeId.value),
        dueDate: dueDate.value,
        priority: priority.value,
      });
      dialog.close();
      ui.toast({ category: 'success', title: 'Task created', description: task.title });
      await load();
    } catch (error) {
      formMessage.textContent = error.message; // the server's text, e.g. "Title is required"
    }
  });

  newTaskButton.addEventListener('click', openDialog);
  document.getElementById('new-task-cancel').addEventListener('click', () => dialog.close());

  load();
})();
