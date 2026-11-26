/* global ui, boardCommands */
/* exported kanban */
// FR8 Kanban board (US8-1, NFR8): three columns of task cards. A card moves by drag-and-drop
// or by keyboard (Space picks up, ←/→ choose a column, Space drops, Esc cancels). Every move
// is a MoveTaskCommand run through one CommandHistory, so dragging, the keyboard and the
// toast's "Undo" share one code path: optimistic move, save, snap back and toast on failure.
const kanban = (() => {
  const { MoveTaskCommand, CommandHistory } = boardCommands;
  const STATUSES = Object.freeze(['TO_DO', 'IN_PROGRESS', 'DONE']);
  const HTTP_CONFLICT = 409;
  const label = (status) => ui.STATUS[status].label;

  /**
   * @param {{ container: HTMLElement, announcer: HTMLElement, api: object }} parts
   * @returns {{ render: Function }}
   */
  function mount({ container, announcer, api }) {
    const history = new CommandHistory();
    const tasks = new Map(); // id → task (status kept up to date)
    const prerequisites = new Map(); // id → ids of the tasks it depends on
    const cards = new Map(); // id → <li>
    const lists = new Map(); // status → <ul>
    const counts = new Map(); // status → count <span>
    let nameOf = () => '';
    let grabbed = null; // keyboard move in progress: { taskId, from, index }

    const announce = (text) => {
      announcer.textContent = text;
    };

    // US8-3/US8-1 AC2: a task is blocked while one of its prerequisites is not Done
    const blockersOf = (taskId) =>
      (prerequisites.get(taskId) ?? [])
        .map((id) => tasks.get(id))
        .filter((task) => task && task.status !== 'DONE');

    function cardFor(task) {
      const due = ui.formatDue(task.dueDate, undefined, { isDone: task.status === 'DONE' });
      const link = ui.el('a', {
        className: 'block font-medium hover:underline',
        text: task.title,
        attrs: { href: `task.html?id=${task.id}`, draggable: 'false' },
      });
      const card = ui.el(
        'li',
        {
          className:
            'cursor-grab rounded-lg border bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary',
          attrs: {
            tabindex: '0',
            draggable: 'true',
            'data-task-id': task.id,
            'aria-describedby': 'board-help',
          },
        },
        ui.el(
          'div',
          { className: 'flex items-center justify-between gap-2' },
          ui.el('span', {
            className: 'font-mono text-xs text-muted-foreground',
            text: `TF-${task.id}`,
          }),
          ui.priorityBadge(task.priority),
        ),
        ui.el('div', { className: 'mt-1.5' }, link),
        ui.el(
          'div',
          { className: 'mt-2 flex items-center gap-2' },
          ui.el('span', {
            className: `text-xs ${due.isLate ? 'text-status-blocked' : 'text-muted-foreground'}`,
            text: due.text,
          }),
          ui.el('span', {
            className: 'badge',
            text: 'Blocked',
            attrs: { 'data-variant': 'destructive', 'data-blocked-badge': '' },
          }),
          ui.el('span', { className: 'ml-auto' }, ui.avatar(nameOf(task.assigneeId))),
        ),
      );
      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(task.id));
        event.dataTransfer.effectAllowed = 'move';
        card.classList.add('opacity-50');
      });
      card.addEventListener('dragend', () => card.classList.remove('opacity-50'));
      card.addEventListener('keydown', (event) => onKey(event, task.id));
      return card;
    }

    function columnFor(status) {
      const list = ui.el('ul', { className: 'flex min-h-24 flex-col gap-2' });
      const count = ui.el('span', { className: 'text-xs text-muted-foreground tabular-nums' });
      const column = ui.el(
        'section',
        {
          className: 'flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 transition-colors',
          attrs: { 'aria-label': label(status), 'data-status': status },
        },
        ui.el(
          'h2',
          { className: 'flex items-center gap-2 text-sm font-medium' },
          ui.statusDot(status),
          ui.el('span', { text: label(status) }),
          count,
        ),
        list,
      );
      column.addEventListener('dragover', (event) => {
        event.preventDefault(); // allows the drop
        column.classList.add('ring-2', 'ring-primary');
      });
      column.addEventListener('dragleave', () => column.classList.remove('ring-2', 'ring-primary'));
      column.addEventListener('drop', (event) => {
        event.preventDefault();
        column.classList.remove('ring-2', 'ring-primary');
        move(Number(event.dataTransfer.getData('text/plain')), status);
      });
      lists.set(status, list);
      counts.set(status, count);
      return column;
    }

    // Puts the card in a column without changing the task (keyboard preview, snap-back)
    function placeCard(taskId, status) {
      const card = cards.get(taskId);
      const hadFocus = document.activeElement === card;
      lists.get(status).append(card);
      if (hadFocus) card.focus(); // moving a node in the DOM drops its focus
    }

    function refreshBadgesAndCounts() {
      cards.forEach((card, taskId) => {
        card.querySelector('[data-blocked-badge]').hidden = blockersOf(taskId).length === 0;
      });
      STATUSES.forEach((status) => {
        counts.get(status).textContent = String(lists.get(status).children.length);
      });
    }

    // The view the commands act on: the card moves and the task's status follows it
    const view = {
      moveCard(taskId, status) {
        placeCard(taskId, status);
        tasks.get(taskId).status = status;
        refreshBadgesAndCounts();
      },
    };

    async function blockerNames(taskId) {
      const known = blockersOf(taskId).map((task) => task.title);
      if (known.length > 0) return known;
      const { prerequisites: fresh } = await api.get(`/tasks/${taskId}/dependencies`);
      return fresh.filter((task) => task.status !== 'DONE').map((task) => task.title);
    }

    async function showMoveError(error, task) {
      if (error.status === HTTP_CONFLICT) {
        const names = await blockerNames(task.id).catch(() => []);
        ui.toast({
          category: 'error',
          title: 'Task is blocked',
          description: names.length ? `Blocked by ${names.join(', ')}` : error.message,
        });
      } else {
        ui.toast({
          category: 'error',
          title: 'Could not move the task',
          description: error.message,
        });
      }
      announce(`${task.title} could not be moved: ${error.message}`);
    }

    async function undoLastMove() {
      try {
        await history.undo();
        announce('Last move undone');
      } catch (error) {
        ui.toast({ category: 'error', title: 'Could not undo', description: error.message });
      }
    }

    async function move(taskId, to) {
      const task = tasks.get(taskId);
      if (!task || task.status === to) return;
      const command = new MoveTaskCommand({ api, view, taskId, from: task.status, to });
      try {
        await history.run(command);
        announce(`${task.title} moved to ${label(to)}`);
        ui.toast({
          category: 'success',
          title: `Moved to ${label(to)}`,
          description: task.title,
          action: { label: 'Undo', onClick: undoLastMove },
        });
      } catch (error) {
        await showMoveError(error, task);
      }
    }

    // NFR8 keyboard moves
    function pickUp(taskId) {
      const { status, title } = tasks.get(taskId);
      grabbed = { taskId, from: status, index: STATUSES.indexOf(status) };
      cards.get(taskId).classList.add('ring-2', 'ring-primary');
      announce(`Picked up ${title} in ${label(status)}. Use the arrow keys, then Space to drop.`);
    }

    function release() {
      const { taskId, from } = grabbed;
      cards.get(taskId).classList.remove('ring-2', 'ring-primary');
      placeCard(taskId, from); // the command moves it again if the drop is saved
      grabbed = null;
      return { taskId, from };
    }

    function shift(step) {
      const index = Math.min(Math.max(grabbed.index + step, 0), STATUSES.length - 1);
      grabbed.index = index;
      placeCard(grabbed.taskId, STATUSES[index]);
      announce(`${label(STATUSES[index])}. Space to drop, Escape to cancel.`);
    }

    function drop() {
      const target = STATUSES[grabbed.index];
      const { taskId, from } = release();
      if (target === from) {
        announce(`${tasks.get(taskId).title} stays in ${label(from)}`);
        return;
      }
      move(taskId, target);
    }

    function cancel() {
      const { taskId, from } = release();
      announce(`Move cancelled. ${tasks.get(taskId).title} stays in ${label(from)}`);
    }

    function onKey(event, taskId) {
      const isGrabbed = grabbed?.taskId === taskId;
      // Imperative: one branch per key, in the order a keyboard user presses them
      if (event.key === ' ') {
        event.preventDefault(); // Space would scroll the page
        if (isGrabbed) drop();
        else if (!grabbed) pickUp(taskId);
        return;
      }
      if (!isGrabbed) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        shift(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    }

    /**
     * @param {object[]} taskList - the project's tasks
     * @param {{ prerequisitesOf: Map<number, number[]>, nameOf: Function }} context
     */
    function render(taskList, context) {
      nameOf = context.nameOf;
      tasks.clear();
      cards.clear();
      prerequisites.clear();
      taskList.forEach((task) => tasks.set(task.id, { ...task }));
      context.prerequisitesOf.forEach((ids, taskId) => prerequisites.set(taskId, ids));
      // Declarative: one column per status, one card per task in its column
      container.removeAttribute('aria-busy');
      container.replaceChildren(...STATUSES.map(columnFor));
      tasks.forEach((task) => {
        const card = cardFor(task);
        cards.set(task.id, card);
        lists.get(task.status).append(card);
      });
      refreshBadgesAndCounts();
    }

    return { render };
  }

  return { mount };
})();
