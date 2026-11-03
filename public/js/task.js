/* global api, layout */
// FR1 task page (task.html?id=<id>): details, one button per status, and the history.
// The server decides who may change the status; a refusal shows the server's 403 text.
(() => {
  const taskId = encodeURIComponent(new URLSearchParams(location.search).get('id'));
  const details = document.getElementById('task-details');
  const buttons = document.getElementById('status-buttons');
  const history = document.getElementById('history');
  const pageError = document.getElementById('task-error');
  const statusMessage = document.getElementById('status-message');
  const STATUS_LABELS = { TO_DO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };

  const element = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });

  async function showDetails(task) {
    const members = await api.get(`/projects/${task.projectId}/members`);
    const assignee = members.find((member) => member.id === task.assigneeId)?.name ?? '—';
    const back = Object.assign(element('a', '← Project tasks'), {
      href: `project.html?id=${task.projectId}`,
    });
    details.replaceChildren(
      back,
      element('h1', task.title),
      element('p', task.description),
      element('p', `Assignee: ${assignee}`),
      element('p', `Priority: ${task.priority}`),
      element('p', `Due: ${task.dueDate}`),
      element('p', `Status: ${STATUS_LABELS[task.status]}`),
    );
  }

  function showButtons(task) {
    // Declarative: one button per status; the current one is disabled
    buttons.replaceChildren(
      ...Object.entries(STATUS_LABELS).map(([status, label]) => {
        const button = element('button', label);
        button.type = 'button';
        button.disabled = status === task.status;
        button.addEventListener('click', () => changeStatus(status));
        return button;
      }),
    );
  }

  async function showHistory() {
    const entries = await api.get(`/tasks/${taskId}/history`);
    if (!entries.length) {
      history.textContent = 'No changes yet';
      return;
    }
    history.replaceChildren(
      ...entries.map((entry) =>
        element(
          'li',
          `${new Date(entry.changedAt).toLocaleString()}: ${entry.changedByName} moved it from ` +
            `${STATUS_LABELS[entry.oldStatus]} to ${STATUS_LABELS[entry.newStatus]}`,
        ),
      ),
    );
  }

  async function load() {
    const task = await api.get(`/tasks/${taskId}`);
    await showDetails(task);
    showButtons(task);
    await showHistory();
  }

  async function changeStatus(status) {
    statusMessage.textContent = '';
    try {
      await api.patch(`/tasks/${taskId}/status`, { status });
      await load();
    } catch (error) {
      statusMessage.textContent = error.message; // e.g. the 403 "Only the assignee or a project manager…"
    }
  }

  layout.userReady.then(load).catch((error) => {
    pageError.textContent = error.message; // e.g. 403 for a non-member, 404 for an unknown task
  });
})();
