/* global api, layout */
// FR6: shows and edits the current task's prerequisites (task.html?id=…).
(() => {
  const taskId = Number(new URLSearchParams(location.search).get('id'));
  const section = document.getElementById('dependencies');
  const STATUS_LABELS = {
    TO_DO: 'To Do',
    IN_PROGRESS: 'In Progress',
    DONE: 'Done',
  };

  const element = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });

  function blockedBadge() {
    const badge = element('span', 'Blocked');
    badge.style.color = '#cf222e';
    badge.style.fontWeight = 'bold';
    return badge;
  }

  function prerequisiteItem(task) {
    return element('li', `${task.title} (${STATUS_LABELS[task.status] ?? task.status})`);
  }

  function render({ prerequisites, isBlocked }, tasks, isManager) {
    const children = [element('h2', 'Dependencies')];
    if (isBlocked) children.push(blockedBadge());

    const list = document.createElement('ul');
    if (prerequisites.length === 0) {
      list.append(element('li', 'No prerequisites'));
    } else {
      list.append(...prerequisites.map(prerequisiteItem));
    }
    children.push(list);

    if (isManager) {
      const existingIds = new Set(prerequisites.map((task) => task.id));
      const options = tasks.filter((task) => task.id !== taskId && !existingIds.has(task.id));
      if (options.length > 0) {
        const select = document.createElement('select');
        select.append(...options.map((task) => new Option(task.title, task.id)));
        const button = element('button', 'Add dependency');
        button.type = 'button';
        button.addEventListener('click', () => addDependency(Number(select.value)));
        children.push(select, button);
      }
    }

    const message = element('p', '');
    message.className = 'form-error';
    children.push(message);
    section.replaceChildren(...children);
  }

  function showError(message) {
    const paragraph = element('p', message);
    paragraph.className = 'form-error';
    section.replaceChildren(paragraph);
  }

  async function addDependency(dependsOnId) {
    try {
      await api.post(`/tasks/${taskId}/dependencies`, { dependsOnId });
      await load();
    } catch (error) {
      const message = section.querySelector('.form-error');
      if (message) message.textContent = error.message;
      else showError(error.message);
    }
  }

  async function load() {
    try {
      const user = await layout.userReady;
      const task = await api.get(`/tasks/${taskId}`);
      const [dependencies, tasks, members] = await Promise.all([
        api.get(`/tasks/${taskId}/dependencies`),
        api.get(`/projects/${task.projectId}/tasks`),
        api.get(`/projects/${task.projectId}/members`),
      ]);
      const me = members.find((member) => member.id === user.id);
      render(dependencies, tasks, me?.role === 'MANAGER');
    } catch (error) {
      showError(error.message);
    }
  }

  load();
})();
