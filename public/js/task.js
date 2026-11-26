/* global api, layout, ui */
// FR1 + FR8 task page (task.html?id=<id>): details, status buttons and history (FR1), the
// Edit dialog (US8-2) and Delete after confirming (US8-3). The server decides every
// permission; hiding Edit/Delete from members is only for convenience.
(() => {
  const taskId = encodeURIComponent(new URLSearchParams(location.search).get('id'));
  const page = document.getElementById('task-page');
  const errorBox = document.getElementById('task-error');
  const titleEl = document.getElementById('task-title');
  const projectLink = document.getElementById('task-project');
  const description = document.getElementById('task-description');
  const actions = document.getElementById('task-actions');
  const buttons = document.getElementById('status-buttons');
  const statusMessage = document.getElementById('status-message');
  const history = document.getElementById('history');
  const dialog = document.getElementById('edit-task-dialog');
  const form = document.getElementById('edit-task-form');
  const formMessage = document.getElementById('edit-task-message');
  const STATUSES = ['TO_DO', 'IN_PROGRESS', 'DONE'];
  let task = null;
  let members = [];

  const nameOf = (userId) => members.find((member) => member.id === userId)?.name ?? '';

  function showProperties() {
    const due = ui.formatDue(task.dueDate, undefined, { isDone: task.status === 'DONE' });
    document
      .getElementById('task-assignee')
      .replaceChildren(
        ui.avatar(nameOf(task.assigneeId)),
        ui.el('span', { text: nameOf(task.assigneeId) }),
      );
    document.getElementById('task-priority').replaceChildren(ui.priorityBadge(task.priority));
    document.getElementById('task-due').replaceChildren(
      ui.el('span', { className: due.isLate ? 'text-status-blocked' : '', text: due.text }),
      ui.el('span', {
        className: 'ml-2 font-mono text-xs text-muted-foreground',
        text: task.dueDate,
      }),
    );
  }

  function showButtons() {
    // Declarative: one button per status; the current one is disabled
    buttons.replaceChildren(
      ...STATUSES.map((status) => {
        const button = ui.el(
          'button',
          {
            className: 'btn',
            attrs: { type: 'button', 'data-variant': 'outline', 'data-size': 'sm' },
          },
          ui.statusDot(status),
          ui.el('span', { text: ui.STATUS[status].label }),
        );
        button.disabled = status === task.status;
        button.addEventListener('click', () => changeStatus(status));
        return button;
      }),
    );
  }

  function historyRow(entry) {
    const when = new Date(entry.changedAt);
    return ui.el(
      'li',
      { className: 'flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5' },
      ui.avatar(entry.changedByName),
      ui.el('span', { className: 'font-medium', text: entry.changedByName }),
      ui.el('span', { className: 'text-muted-foreground', text: 'moved it from' }),
      ui.statusDot(entry.oldStatus),
      ui.el('span', { text: ui.STATUS[entry.oldStatus].label }),
      ui.el('span', { className: 'text-muted-foreground', text: 'to' }),
      ui.statusDot(entry.newStatus),
      ui.el('span', { text: ui.STATUS[entry.newStatus].label }),
      ui.el('time', {
        className: 'ml-auto text-xs text-muted-foreground',
        text: when.toLocaleString(),
        attrs: { datetime: entry.changedAt },
      }),
    );
  }

  async function showHistory() {
    const entries = await api.get(`/tasks/${taskId}/history`);
    if (entries.length === 0) {
      ui.empty(history, {
        icon: 'history',
        title: 'No changes yet',
        body: 'Each status change is listed here with who made it and when.',
      });
      return;
    }
    history.replaceChildren(...entries.map(historyRow));
  }

  function showTask(isManager) {
    titleEl.textContent = task.title;
    document.title = `${task.title} – TaskFlow`;
    description.textContent = task.description || 'No description.';
    actions.hidden = !isManager;
    showProperties();
    showButtons();
  }

  function showError(error) {
    titleEl.textContent = 'Task';
    page.hidden = true;
    errorBox.hidden = false;
    ui.errorState(errorBox, error, load); // the server's message + "Try again"
  }

  async function load() {
    errorBox.hidden = true;
    page.hidden = false;
    ui.skeletonRows(history); // 1. loading
    try {
      const user = await layout.userReady;
      task = await api.get(`/tasks/${taskId}`);
      const [team, project] = await Promise.all([
        api.get(`/projects/${task.projectId}/members`),
        api.get(`/projects/${task.projectId}`),
      ]);
      members = team;
      projectLink.textContent = project.name;
      projectLink.href = `project.html?id=${task.projectId}`;
      showTask(members.find((member) => member.id === user.id)?.role === 'MANAGER');
      await showHistory(); // 2. empty or 3. success
    } catch (error) {
      showError(error); // 4. error
    }
  }

  async function changeStatus(status) {
    statusMessage.textContent = '';
    try {
      await api.patch(`/tasks/${taskId}/status`, { status });
      await load();
    } catch (error) {
      statusMessage.textContent = error.message; // e.g. 403 "Only the assignee or a project manager…"
    }
  }

  // US8-2: the dialog starts with the task's current values
  function openEdit() {
    formMessage.textContent = '';
    const { title, description: text, assigneeId, dueDate, priority } = form.elements;
    title.value = task.title;
    text.value = task.description;
    assigneeId.replaceChildren(...members.map((member) => new Option(member.name, member.id)));
    assigneeId.value = String(task.assigneeId);
    dueDate.value = task.dueDate;
    priority.value = task.priority;
    dialog.showModal();
    title.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = '';
    const { title, description: text, assigneeId, dueDate, priority } = form.elements;
    try {
      const saved = await api.patch(`/tasks/${taskId}`, {
        title: title.value,
        description: text.value.trim(),
        assigneeId: Number(assigneeId.value),
        dueDate: dueDate.value,
        priority: priority.value,
      });
      dialog.close();
      ui.toast({ category: 'success', title: 'Task updated', description: saved.title });
      await load();
    } catch (error) {
      formMessage.textContent = error.message; // the server's text, e.g. "Title is required"
    }
  });

  // US8-3: ask first, naming the task; then go back to the project's board
  async function deleteTask() {
    const confirmed = await ui.confirm({
      title: `Delete "${task.title}"?`,
      body: 'Its comments and history are removed too. Tasks that depended on it are no longer blocked.',
      confirmLabel: 'Delete task',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      location.href = `project.html?id=${task.projectId}`;
    } catch (error) {
      ui.toast({
        category: 'error',
        title: 'Could not delete the task',
        description: error.message,
      });
    }
  }

  document.getElementById('edit-task').addEventListener('click', openEdit);
  document.getElementById('edit-task-cancel').addEventListener('click', () => dialog.close());
  document.getElementById('delete-task').addEventListener('click', deleteTask);

  load();
})();
