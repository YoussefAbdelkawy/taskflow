/* global api, layout */
(() => {
  const taskId = new URLSearchParams(location.search).get('id');
  const section = document.getElementById('comments');
  const error = document.createElement('p');
  error.className = 'form-error';
  error.setAttribute('role', 'alert');

  const element = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
  const commentUrl = `/tasks/${encodeURIComponent(taskId)}/comments`;

  function commentItem(comment) {
    const item = document.createElement('li');
    const heading = document.createElement('p');
    const author = element('strong', comment.name);
    const time = element('time', new Date(comment.createdAt).toLocaleString());
    time.dateTime = comment.createdAt;
    heading.append(author, document.createTextNode(' · '), time);
    item.append(heading, element('p', comment.content));
    return item;
  }

  function showComments(comments) {
    const list = document.createElement('ul');
    if (!comments.length) {
      list.append(element('li', 'No comments yet'));
    } else {
      // Declarative: render the ordered comments returned by the repository.
      list.replaceChildren(...comments.map(commentItem));
    }
    section.replaceChildren(element('h2', 'Comments'), list, form, error);
  }

  const form = document.createElement('form');
  const label = element('label', 'Add a comment');
  const content = document.createElement('textarea');
  content.name = 'content';
  content.rows = 3;
  label.append(content);
  const send = element('button', 'Send');
  send.type = 'submit';
  form.append(label, send);

  async function loadComments() {
    if (!taskId) throw new Error('Task ID is missing');
    showComments(await api.get(commentUrl));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    send.disabled = true;
    try {
      const comment = await api.post(commentUrl, { content: content.value });
      content.value = '';
      const existing = section.querySelector('ul');
      const item = commentItem(comment);
      if (existing?.textContent === 'No comments yet') {
        existing.replaceChildren(item);
      } else {
        existing?.append(item);
      }
    } catch (requestError) {
      error.textContent = requestError.message;
    } finally {
      send.disabled = false;
    }
  });

  layout.userReady.then(loadComments).catch((requestError) => {
    section.replaceChildren(element('h2', 'Comments'), form, error);
    error.textContent = requestError.message;
  });
})();
