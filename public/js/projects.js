/* global api, layout */
(() => {
  const list = document.getElementById('project-list');
  const pageError = document.getElementById('projects-error');
  const createForm = document.getElementById('new-project-form');
  const createMessage = document.getElementById('new-project-message');

  const element = (tag, { className, text, href, type, value } = {}) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    if (href) node.href = href;
    if (type) node.type = type;
    if (value) node.value = value;
    return node;
  };

  function memberForm(project) {
    const form = document.createElement('form');
    const heading = element('h3', { text: 'Add a member' });
    const emailLabel = element('label', { text: 'Member email' });
    const email = element('input', { type: 'email' });
    email.required = true;
    email.autocomplete = 'email';
    emailLabel.append(email);

    const roleLabel = element('label', { text: 'Role' });
    const role = element('select');
    role.append(new Option('Member', 'MEMBER'), new Option('Manager', 'MANAGER'));
    roleLabel.append(role);

    const submit = element('button', { text: 'Add member', type: 'submit' });
    const message = element('p', { className: 'form-error' });
    message.setAttribute('role', 'status');
    form.append(heading, emailLabel, roleLabel, submit, message);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      try {
        const member = await api.post(`/projects/${project.id}/members`, {
          email: email.value.trim(),
          role: role.value,
        });
        message.textContent = `Added ${member.name} as ${member.role.toLowerCase()}.`;
        form.reset();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    return form;
  }

  function projectCard(project) {
    const item = document.createElement('li');
    const card = document.createElement('article');
    const link = element('a', {
      text: project.name,
      href: `project.html?id=${encodeURIComponent(project.id)}`,
    });
    const title = element('h2');
    title.append(link);
    const description = element('p', { text: project.description || 'No description' });
    const startDate = element('p', { text: `Started ${project.startDate}` });
    card.append(title, description, startDate, memberForm(project));
    item.append(card);
    return item;
  }

  async function showProjects() {
    const projects = await api.get('/projects');
    if (!projects.length) {
      list.textContent = 'No projects yet';
      return;
    }
    // Declarative: render one project card for each project returned by the API.
    list.replaceChildren(...projects.map(projectCard));
  }

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    createMessage.textContent = '';
    const { name, description } = createForm.elements;
    try {
      await api.post('/projects', {
        name: name.value.trim(),
        description: description.value.trim(),
      });
      createForm.reset();
      await showProjects();
    } catch (error) {
      createMessage.textContent = error.message;
    }
  });

  layout.userReady.then(showProjects).catch((error) => {
    pageError.textContent = error.message;
  });
})();
