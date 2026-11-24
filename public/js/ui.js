/* exported ui */
// Shared UI helpers (DESIGN.md §6): icons, toasts, the confirm dialog, loading / empty /
// error states and the date, status and priority formatting every page uses.
// Load it after api.js and before the page's own script. Pure helpers (formatDue,
// initials, STATUS, PRIORITY, greeting, todayIso) are unit-tested in tests/unit/public.
const ui = (() => {
  const SPRITE = 'vendor/lucide.svg';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MS_PER_DAY = 86400000;
  const LAST_WEEKDAY = 6;
  const AFTERNOON = 12;
  const EVENING = 17;
  const DEFAULT_SKELETON_ROWS = 4;
  const ISO_DATE_LENGTH = 10;
  const MS_PER_MINUTE = 60000;
  const YEAR_LENGTH = 4;
  const INITIALS_LENGTH = 2;

  const STATUS = Object.freeze({
    TO_DO: Object.freeze({ label: 'To do', dotClass: 'bg-status-todo' }),
    IN_PROGRESS: Object.freeze({ label: 'In progress', dotClass: 'bg-status-progress' }),
    DONE: Object.freeze({ label: 'Done', dotClass: 'bg-status-done' }),
    BLOCKED: Object.freeze({ label: 'Blocked', dotClass: 'bg-status-blocked' }),
  });

  // Priority is a badge, never a colour (DESIGN.md §3)
  const PRIORITY = Object.freeze({
    HIGH: Object.freeze({ label: 'High', variant: 'outline' }),
    MEDIUM: Object.freeze({ label: 'Medium', variant: 'secondary' }),
    LOW: Object.freeze({ label: 'Low', variant: 'secondary' }),
  });

  // ---- pure helpers ----

  const utcDay = (text) => Date.parse(`${text}T00:00:00Z`);

  /** @returns {string} the local calendar day as YYYY-MM-DD */
  function todayIso(now = new Date()) {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * MS_PER_MINUTE);
    return local.toISOString().slice(0, ISO_DATE_LENGTH);
  }

  function shortDate(dueDate, today) {
    const sameYear = dueDate.slice(0, YEAR_LENGTH) === today.slice(0, YEAR_LENGTH);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    }).format(new Date(utcDay(dueDate)));
  }

  /**
   * Relative due date for lists: "3d late", "Today", "Tomorrow", "Fri", "12 Dec".
   * @returns {{ text: string, isLate: boolean }}
   */
  function formatDue(dueDate, today = todayIso(), { isDone = false } = {}) {
    const days = Math.round((utcDay(dueDate) - utcDay(today)) / MS_PER_DAY);
    // Imperative: the closest matching case wins, in order
    if (isDone) return { text: shortDate(dueDate, today), isLate: false };
    if (days < 0) return { text: `${-days}d late`, isLate: true };
    if (days === 0) return { text: 'Today', isLate: false };
    if (days === 1) return { text: 'Tomorrow', isLate: false };
    if (days <= LAST_WEEKDAY) {
      const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
      return { text: weekday.format(new Date(utcDay(dueDate))), isLate: false };
    }
    return { text: shortDate(dueDate, today), isLate: false };
  }

  /** @returns {string} "Mona Adel" -> "MA", "Mona" -> "MO", nothing -> "?" */
  function initials(name) {
    // Declarative: split into words, keep non-empty ones, take first letters
    const words = String(name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, INITIALS_LENGTH).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  function greeting(hour = new Date().getHours()) {
    if (hour < AFTERNOON) return 'Good morning';
    if (hour < EVENING) return 'Good afternoon';
    return 'Good evening';
  }

  // ---- DOM helpers (browser only) ----

  /** Small element factory: el('span', { className, text, attrs }, ...children) */
  function el(tag, { className, text, attrs = {} } = {}, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    node.append(...children.filter(Boolean));
    return node;
  }

  /** A Lucide icon from the sprite, hidden from screen readers */
  function icon(name, className = '') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', `lucide ${className}`.trim());
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `${SPRITE}#${name}`);
    svg.append(use);
    return svg;
  }

  const avatar = (name) =>
    el('span', { className: 'avatar', text: initials(name), attrs: { title: name ?? '' } });

  function statusDot(status) {
    const meta = STATUS[status] ?? STATUS.TO_DO;
    return el('span', {
      className: `status-dot ${meta.dotClass}`,
      attrs: { role: 'img', 'aria-label': meta.label },
    });
  }

  function priorityBadge(priority) {
    const meta = PRIORITY[priority] ?? PRIORITY.MEDIUM;
    return el('span', {
      className: 'badge',
      text: meta.label,
      attrs: { 'data-variant': meta.variant },
    });
  }

  function toaster() {
    let list = document.getElementById('toaster');
    if (!list) {
      list = el('ol', { className: 'toaster', attrs: { id: 'toaster', 'aria-live': 'polite' } });
      document.body.append(list);
    }
    return list;
  }

  /**
   * @param {{ category?: 'success'|'error'|'info'|'warning', title: string, description?: string,
   *           action?: { label: string, onClick: Function } }} options
   */
  function toast({ category = 'info', title, description, action }) {
    const list = toaster();
    // Basecoat adds .toast() to the toaster once its script has run
    if (typeof list.toast !== 'function') return null;
    const item = list.toast({
      category,
      title,
      description,
      action: action && { label: action.label },
    });
    if (action)
      item.querySelector('[data-toast-action]')?.addEventListener('click', action.onClick);
    return item;
  }

  /** @returns {Promise<boolean>} true when the user confirms (Basecoat dialog) */
  function confirm({ title, body, confirmLabel = 'Confirm', destructive = false }) {
    const cancel = el('button', {
      className: 'btn',
      text: 'Cancel',
      attrs: { type: 'button', 'data-variant': 'outline', 'data-size': 'sm' },
    });
    const accept = el('button', {
      className: 'btn',
      text: confirmLabel,
      attrs: {
        type: 'button',
        'data-size': 'sm',
        ...(destructive ? { 'data-variant': 'destructive' } : {}),
      },
    });
    const dialog = el(
      'dialog',
      { className: 'dialog', attrs: { 'aria-labelledby': 'confirm-title' } },
      el(
        'div',
        {},
        el(
          'header',
          {},
          el('h2', { text: title, attrs: { id: 'confirm-title' } }),
          body ? el('p', { text: body }) : null,
        ),
        el('footer', {}, cancel, accept),
      ),
    );
    document.body.append(dialog);
    return new Promise((resolve) => {
      const close = (answer) => {
        dialog.close();
        dialog.remove();
        resolve(answer);
      };
      cancel.addEventListener('click', () => close(false));
      accept.addEventListener('click', () => close(true));
      dialog.addEventListener('cancel', () => close(false));
      dialog.showModal();
      cancel.focus();
    });
  }

  /** Loading state: skeleton rows shaped like list rows */
  function skeletonRows(container, count = DEFAULT_SKELETON_ROWS) {
    container.setAttribute('aria-busy', 'true');
    container.replaceChildren(
      ...Array.from({ length: count }, () =>
        el(
          'div',
          { className: 'flex items-center gap-3 px-4 py-3' },
          el('div', { className: 'skeleton size-2 rounded-full' }),
          el('div', { className: 'skeleton h-3 w-14' }),
          el('div', { className: 'skeleton h-3 flex-1' }),
          el('div', { className: 'skeleton h-3 w-12' }),
        ),
      ),
    );
  }

  /** Empty state: icon, one-line title, one helpful sentence, optional action */
  function empty(container, { icon: iconName = 'inbox', title, body, action }) {
    container.removeAttribute('aria-busy');
    container.replaceChildren(
      el(
        'section',
        { className: 'empty py-10' },
        el(
          'header',
          {},
          el(
            'div',
            { attrs: { 'data-slot': 'empty-icon', 'data-variant': 'icon' } },
            icon(iconName),
          ),
          el('h3', { text: title }),
          body ? el('p', { text: body }) : null,
        ),
        action ? el('section', {}, action) : null,
      ),
    );
  }

  /** Error state: what failed (the server's text) and a "Try again" button */
  function errorState(container, error, retry) {
    container.removeAttribute('aria-busy');
    const button = retry
      ? el('button', {
          className: 'btn',
          text: 'Try again',
          attrs: { type: 'button', 'data-variant': 'outline', 'data-size': 'sm' },
        })
      : null;
    button?.addEventListener('click', retry);
    container.replaceChildren(
      el(
        'div',
        { className: 'alert m-4', attrs: { 'data-variant': 'destructive', role: 'alert' } },
        icon('circle-alert'),
        el('h2', { text: 'Could not load this' }),
        el('section', {}, el('p', { text: error?.message ?? 'Something went wrong' }), button),
      ),
    );
  }

  return {
    STATUS,
    PRIORITY,
    todayIso,
    formatDue,
    initials,
    greeting,
    el,
    icon,
    avatar,
    statusDot,
    priorityBadge,
    toast,
    confirm,
    skeletonRows,
    empty,
    errorState,
  };
})();
