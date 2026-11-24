/* global api, ui */
/* exported layout */
// The app shell from DESIGN.md §5, built once here and never copied into pages:
// sidebar (navigation, the user's projects, user menu with theme and logout) and a sticky
// topbar (breadcrumb, search, bell) rendered into <header id="app-header">.
// Pages wait for the logged-in user with layout.userReady.
// Hooks for teammates: the search button and Ctrl/Cmd K dispatch "taskflow:open-search",
// the bell dispatches "taskflow:open-notifications". A listener that handles one calls
// event.preventDefault(); without a listener the shell falls back to a plain page link.
const layout = (() => {
  const NOTIFICATION_POLL_MS = 10000;
  const THEME_KEY = 'taskflow.theme';
  const THEMES = ['light', 'dark', 'system'];
  const COMPLETE = 100;
  const page = location.pathname.split('/').pop() || 'index.html';
  const isLoginPage = page === 'login.html';
  const el = (...args) => ui.el(...args);

  const NAV = [
    { href: 'index.html', label: 'Dashboard', icon: 'layout-dashboard' },
    { href: 'my-tasks.html', label: 'My tasks', icon: 'circle-check' },
    { href: 'projects.html', label: 'Projects', icon: 'folder-kanban' },
    { href: 'notifications.html', label: 'Notifications', icon: 'bell', id: 'nav-notifications' },
    { href: 'reports.html', label: 'Reports', icon: 'chart-column', managersOnly: true },
  ];

  let unreadCountElement = null;
  let bellDot = null;

  // ---------------------------------------------------------------- theme
  function readTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'system';
    } catch {
      return 'system';
    }
  }

  function setTheme(choice) {
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      // the choice still applies to this page
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle(
      'dark',
      choice === 'dark' || (choice === 'system' && prefersDark),
    );
    document
      .querySelectorAll('[data-theme-choice]')
      .forEach((item) =>
        item.setAttribute('aria-checked', String(item.dataset.themeChoice === choice)),
      );
  }

  // ---------------------------------------------------------------- sidebar
  function navLink({ href, label, icon, id }) {
    const link = el('a', { attrs: { href } }, ui.icon(icon), el('span', { text: label }));
    if (href === page) link.setAttribute('aria-current', 'page');
    if (id) {
      unreadCountElement = el('span', {
        className: 'badge ml-auto hidden',
        attrs: { 'data-variant': 'secondary', 'aria-live': 'polite' },
      });
      link.id = id;
      link.append(unreadCountElement);
    }
    return el('li', {}, link);
  }

  function projectLinks(projects) {
    if (projects.length === 0) return null;
    // Declarative: one link per project, the dot shows how far along it is
    const items = projects.map((project) => {
      const href = `project.html?id=${project.id}`;
      const link = el(
        'a',
        { attrs: { href } },
        el('span', {
          className: `status-dot ${project.progress === COMPLETE ? 'bg-status-done' : 'bg-primary'}`,
        }),
        el('span', { text: project.name }),
      );
      if (`${page}${location.search}` === href) link.setAttribute('aria-current', 'page');
      return el('li', {}, link);
    });
    return el(
      'div',
      { attrs: { role: 'group', 'aria-labelledby': 'nav-projects' } },
      el('h3', { text: 'Projects', attrs: { id: 'nav-projects' } }),
      el('ul', {}, ...items),
    );
  }

  function themeItem(choice) {
    const item = el('div', {
      text: choice[0].toUpperCase() + choice.slice(1),
      attrs: { role: 'menuitemradio', 'data-theme-choice': choice, 'aria-checked': 'false' },
    });
    item.addEventListener('click', () => setTheme(choice));
    return item;
  }

  function userMenu(user) {
    const logoutItem = el(
      'div',
      { attrs: { role: 'menuitem', id: 'logout' } },
      ui.icon('log-out'),
      el('span', { text: 'Log out' }),
    );
    logoutItem.addEventListener('click', logout);
    return el(
      'div',
      { className: 'dropdown-menu w-full' },
      el(
        'button',
        {
          className: 'btn w-full justify-start',
          attrs: {
            type: 'button',
            'data-variant': 'ghost',
            id: 'user-menu-trigger',
            'aria-haspopup': 'menu',
            'aria-controls': 'user-menu',
            'aria-expanded': 'false',
          },
        },
        ui.avatar(user.name),
        el('span', { className: 'truncate', text: user.name, attrs: { id: 'app-user-name' } }),
        ui.icon('chevrons-up-down', 'ml-auto text-muted-foreground'),
      ),
      el(
        'div',
        {
          attrs: {
            'data-popover': '',
            'aria-hidden': 'true',
            'data-side': 'top',
            'data-align': 'start',
          },
        },
        el(
          'div',
          { attrs: { role: 'menu', id: 'user-menu', 'aria-labelledby': 'user-menu-trigger' } },
          el(
            'div',
            { attrs: { role: 'group', 'aria-labelledby': 'theme-heading' } },
            el('div', { text: 'Theme', attrs: { role: 'heading', id: 'theme-heading' } }),
            ...THEMES.map(themeItem),
          ),
          el('hr', { attrs: { role: 'separator' } }),
          logoutItem,
        ),
      ),
    );
  }

  function renderSidebar(user, projects) {
    const isManager = projects.some((project) => project.isManager);
    const links = NAV.filter((item) => !item.managersOnly || isManager).map(navLink);
    return el(
      'aside',
      {
        className: 'sidebar',
        attrs: { id: 'sidebar', 'data-side': 'left', 'aria-hidden': 'false' },
      },
      el(
        'nav',
        { attrs: { 'aria-label': 'Main' } },
        el(
          'header',
          {},
          el(
            'a',
            { className: 'flex items-center gap-2 px-2 py-1.5', attrs: { href: 'index.html' } },
            el('span', {
              className:
                'grid size-7 place-items-center rounded-md bg-foreground text-background text-xs font-bold',
              text: 'TF',
            }),
            el('span', { className: 'font-semibold tracking-tight', text: 'TaskFlow' }),
          ),
        ),
        el(
          'section',
          {},
          el('div', { attrs: { role: 'group' } }, el('ul', {}, ...links)),
          projectLinks(projects),
        ),
        el('footer', { className: 'p-2' }, userMenu(user)),
      ),
    );
  }

  // ---------------------------------------------------------------- topbar
  // A hook another script can take over (preventDefault); otherwise follow the fallback link
  function dispatchOr(eventName, fallbackHref) {
    const event = new CustomEvent(eventName, { cancelable: true });
    if (document.dispatchEvent(event)) location.href = fallbackHref;
  }

  function renderTopbar(header) {
    const crumb =
      document.querySelector('main')?.dataset.breadcrumb ?? document.title.split(' ')[0];
    const menuButton = el(
      'button',
      {
        className: 'btn md:hidden',
        attrs: {
          type: 'button',
          'data-variant': 'ghost',
          'data-size': 'icon-sm',
          'aria-label': 'Menu',
        },
      },
      ui.icon('menu'),
    );
    menuButton.addEventListener('click', () => document.getElementById('sidebar')?.toggle?.());
    const search = el(
      'button',
      {
        className:
          'btn hidden w-56 justify-between font-normal text-muted-foreground sm:inline-flex',
        attrs: { type: 'button', 'data-variant': 'outline', 'data-size': 'sm', id: 'open-search' },
      },
      el('span', { className: 'flex items-center gap-2' }, ui.icon('search'), 'Search'),
      el('span', { className: 'kbd', text: 'Ctrl K' }),
    );
    search.addEventListener('click', () => dispatchOr('taskflow:open-search', 'my-tasks.html'));
    bellDot = el('span', {
      className: 'absolute right-1.5 top-1.5 hidden size-1.5 rounded-full bg-primary',
    });
    const bell = el(
      'button',
      {
        className: 'btn relative',
        attrs: {
          type: 'button',
          'data-variant': 'ghost',
          'data-size': 'icon-sm',
          'aria-label': 'Notifications',
          id: 'open-notifications',
        },
      },
      ui.icon('bell'),
      bellDot,
    );
    bell.addEventListener('click', () =>
      dispatchOr('taskflow:open-notifications', 'notifications.html'),
    );

    header.className =
      'sticky top-0 z-10 flex h-12 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6';
    header.replaceChildren(
      menuButton,
      el(
        'nav',
        { className: 'text-sm text-muted-foreground', attrs: { 'aria-label': 'Breadcrumb' } },
        'Workspace',
        el('span', { className: 'mx-1', text: '/' }),
        el('span', { className: 'text-foreground', text: crumb }),
      ),
      el('div', { className: 'ml-auto flex items-center gap-2' }, search, bell),
    );
  }

  function onShortcut(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dispatchOr('taskflow:open-search', 'my-tasks.html');
    }
  }

  // ---------------------------------------------------------------- frame
  // Moves the page's own content next to the sidebar, so pages keep their plain markup
  function mountShell(sidebar) {
    const frame = el('div', { className: 'min-h-screen', attrs: { id: 'app-frame' } });
    const content = [...document.body.children].filter(
      (node) => !['SCRIPT', 'DIALOG'].includes(node.tagName) && node.id !== 'toaster',
    );
    frame.append(...content);
    document.body.prepend(sidebar, frame);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      api.clearToken();
      location.href = 'login.html';
    }
  }

  async function refreshUnreadCount() {
    if (!unreadCountElement) return;
    try {
      const { count } = await api.get('/notifications/unread-count');
      unreadCountElement.textContent = String(count);
      unreadCountElement.classList.toggle('hidden', count === 0);
      bellDot?.classList.toggle('hidden', count === 0);
      document
        .getElementById('open-notifications')
        ?.setAttribute('aria-label', `Notifications, ${count} unread`);
    } catch {
      // the count is a hint; the notifications page shows the real error
    }
  }

  async function loadProjects() {
    try {
      return (await api.get('/dashboard')).projects;
    } catch {
      return [];
    }
  }

  async function init() {
    const header = document.getElementById('app-header');
    if (isLoginPage || !header) return null;

    renderTopbar(header);
    document.addEventListener('keydown', onShortcut);
    // Mount an empty sidebar at once so the page does not jump, then fill it in
    const placeholder = renderSidebar({ name: '' }, []);
    mountShell(placeholder);
    const user = await api.get('/auth/me'); // a 401 sends the browser to login.html
    placeholder.replaceWith(renderSidebar(user, await loadProjects()));
    setTheme(readTheme());
    refreshUnreadCount();
    setInterval(refreshUnreadCount, NOTIFICATION_POLL_MS);
    return user;
  }

  return { userReady: init(), refreshUnreadCount, setTheme };
})();
