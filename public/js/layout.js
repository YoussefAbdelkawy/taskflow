/* global api */
/* exported layout */
// Fills <header id="app-header"> on every page: app name, links, the user's name, Logout.
// Other scripts can wait for the logged-in user with layout.userReady.
const layout = (() => {
  const NOTIFICATION_POLL_MS = 3000;
  const LINKS = [
    { href: 'index.html', label: 'Home' },
    { href: 'projects.html', label: 'Projects' },
    { href: 'my-tasks.html', label: 'My tasks' },
    { href: 'notifications.html', label: 'Notifications' },
  ];
  const isLoginPage = location.pathname.endsWith('/login.html');
  let unreadCountElement = null;

  function element(tag, { className, text, href } = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    if (href) node.href = href;
    return node;
  }

  function renderBrand(header) {
    header.className = 'app-header';
    header.append(element('a', { className: 'app-name', text: 'TaskFlow', href: 'index.html' }));
  }

  function renderNavigation(header) {
    const nav = element('nav', { className: 'app-nav' });
    // Declarative: one link per entry
    nav.append(...LINKS.map(({ href, label }) => element('a', { href, text: label })));
    header.append(nav);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      api.clearToken();
      location.href = 'login.html';
    }
  }

  function renderUser(header, user) {
    const box = element('div', { className: 'app-user' });
    const bell = element('a', {
      className: 'notification-bell',
      text: '🔔 ',
      href: 'notifications.html',
    });
    unreadCountElement = element('span', { className: 'notification-count', text: '0' });
    bell.append(unreadCountElement);
    bell.setAttribute('aria-label', 'Notifications, 0 unread');
    const button = element('button', { className: 'button-secondary', text: 'Logout' });
    button.type = 'button';
    button.addEventListener('click', logout);
    box.append(bell, element('span', { className: 'app-user-name', text: user.name }), button);
    header.append(box);
  }

  async function refreshUnreadCount() {
    if (!unreadCountElement) return;
    try {
      const { count } = await api.get('/notifications/unread-count');
      unreadCountElement.textContent = String(count);
      unreadCountElement.parentElement.setAttribute('aria-label', `Notifications, ${count} unread`);
    } catch {
      unreadCountElement.textContent = '?';
    }
  }

  async function init() {
    const header = document.getElementById('app-header');
    if (header) renderBrand(header);
    if (isLoginPage) return null;

    const user = await api.get('/auth/me'); // a 401 sends the browser to login.html
    if (header) {
      renderNavigation(header);
      renderUser(header, user);
      refreshUnreadCount();
      setInterval(refreshUnreadCount, NOTIFICATION_POLL_MS);
    }
    return user;
  }

  return { userReady: init(), refreshUnreadCount };
})();
