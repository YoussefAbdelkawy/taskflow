/* global api, layout, ui */
// US7-3 Dashboard: greeting, my counts, my next tasks and my projects' progress.
(() => {
  const dueSoon = document.getElementById('due-soon');
  const progress = document.getElementById('project-progress');
  const { el } = ui;
  // skeleton rows while loading, shaped like the real lists
  const DUE_SOON_ROWS = 4;
  const PROJECT_ROWS = 3;

  // Server status line (kept from M1: proves the frontend reaches the backend)
  api
    .get('/health')
    .then((data) => {
      document.getElementById('status').textContent =
        data.status === 'ok' ? 'all systems normal' : data.status;
      document.getElementById('status-dot').className = 'status-dot bg-status-done';
    })
    .catch(() => {
      document.getElementById('status').textContent = 'offline';
      document.getElementById('status-dot').className = 'status-dot bg-status-blocked';
    });

  function showGreeting(user) {
    const firstName = user.name.split(' ')[0];
    document.getElementById('welcome').textContent = `${ui.greeting()}, ${firstName}`;
    document.getElementById('today').textContent = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  }

  function showStats(stats) {
    // Declarative: one number per data-stat attribute
    document.querySelectorAll('[data-stat]').forEach((cell) => {
      cell.textContent = String(stats[cell.dataset.stat]);
    });
    document
      .querySelector('[data-stat="overdue"]')
      .classList.toggle('text-status-blocked', stats.overdue > 0);
  }

  function taskRow(task, today) {
    const due = ui.formatDue(task.dueDate, today);
    return el(
      'a',
      { className: 'row-link', attrs: { href: `task.html?id=${task.id}` } },
      ui.statusDot(task.status),
      el('span', {
        className: 'w-14 font-mono text-xs text-muted-foreground',
        text: `TF-${task.id}`,
      }),
      el(
        'span',
        { className: 'min-w-0 flex-1' },
        el('span', { className: 'block truncate', text: task.title }),
        el('span', {
          className: 'block truncate text-xs text-muted-foreground',
          text: task.projectName,
        }),
      ),
      el('span', { className: 'max-sm:hidden' }, ui.priorityBadge(task.priority)),
      el('span', {
        className: `w-16 text-right text-xs ${due.isLate ? 'text-status-blocked' : 'text-muted-foreground'}`,
        text: due.text,
      }),
    );
  }

  function showDueSoon(tasks) {
    dueSoon.removeAttribute('aria-busy');
    if (tasks.length === 0) {
      ui.empty(dueSoon, {
        icon: 'circle-check',
        title: 'Nothing due',
        body: 'You have no open tasks. New tasks assigned to you will show up here.',
      });
      return;
    }
    const today = ui.todayIso();
    dueSoon.replaceChildren(...tasks.map((task) => taskRow(task, today)));
  }

  function projectRow(project) {
    const bar = el('div', { className: 'h-full rounded-full bg-primary' });
    bar.style.width = `${project.progress}%`;
    return el(
      'a',
      {
        className: 'block px-4 py-3 hover:bg-muted/50',
        attrs: { href: `project.html?id=${project.id}` },
      },
      el(
        'div',
        { className: 'flex justify-between gap-3 text-sm' },
        el('span', { className: 'truncate', text: project.name }),
        el('span', {
          className: 'tabular-nums text-muted-foreground',
          text: `${project.progress}%`,
        }),
      ),
      el(
        'div',
        {
          className: 'mt-2 h-1.5 rounded-full bg-muted',
          attrs: {
            role: 'progressbar',
            'aria-valuenow': String(project.progress),
            'aria-valuemin': '0',
            'aria-valuemax': '100',
            'aria-label': `${project.name} progress`,
          },
        },
        bar,
      ),
      el('p', {
        className: 'mt-1.5 text-xs text-muted-foreground',
        text: `${project.done} of ${project.total} tasks done`,
      }),
    );
  }

  function showProjects(projects) {
    progress.removeAttribute('aria-busy');
    if (projects.length === 0) {
      const create = el('a', {
        className: 'btn',
        text: 'Create a project',
        attrs: { href: 'projects.html', 'data-size': 'sm' },
      });
      ui.empty(progress, {
        icon: 'folder-kanban',
        title: 'No projects yet',
        body: 'Create a project or ask a manager to add you.',
        action: create,
      });
      return;
    }
    progress.classList.add('divide-y');
    progress.replaceChildren(...projects.map(projectRow));
  }

  async function load() {
    ui.skeletonRows(dueSoon, DUE_SOON_ROWS);
    ui.skeletonRows(progress, PROJECT_ROWS);
    try {
      const dashboard = await api.get('/dashboard');
      showStats(dashboard.stats);
      showDueSoon(dashboard.dueSoon);
      showProjects(dashboard.projects);
    } catch (error) {
      ui.errorState(dueSoon, error, load);
      ui.errorState(progress, error, load);
    }
  }

  layout.userReady
    .then((user) => {
      showGreeting(user);
      return load();
    })
    .catch(() => {
      // not logged in: api.js is already sending the browser to login.html
    });
})();
