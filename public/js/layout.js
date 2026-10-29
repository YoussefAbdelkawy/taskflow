/* global api */
/* exported layout */
// Fills <header id="app-header"> on every page: app name, links, the user's name, Logout.
// Other scripts can wait for the logged-in user with layout.userReady.
const layout = (() => {
  const LINKS = [
    { href: 'index.html', label: 'Home' },
    { href: 'projects.html', label: 'Projects' },
    { href: 'my-tasks.html', label: 'My tasks' },
    { href: 'notifications.html', label: 'Notifications' },
  ];
  const isLoginPage = location.pathname.endsWith('/login.html');

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
    const button = element('button', { className: 'button-secondary', text: 'Logout' });
    button.type = 'button';
    button.addEventListener('click', logout);
    box.append(element('span', { className: 'app-user-name', text: user.name }), button);
    header.append(box);
  }

  async function init() {
    const header = document.getElementById('app-header');
    if (header) renderBrand(header);
    if (isLoginPage) return null;

    const user = await api.get('/auth/me'); // a 401 sends the browser to login.html
    if (header) {
      renderNavigation(header);
      renderUser(header, user);
    }
    return user;
  }

  return { userReady: init() };
})();
