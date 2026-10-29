/* global api */
// FR2 widget: lets a manager make the task on task.html?id=<id> repeat.
// Renders into <section id="recurrence"> (task.html arrives in turn 2); does nothing without it.
(() => {
  const section = document.getElementById('recurrence');
  if (!section) return;

  const taskId = new URLSearchParams(location.search).get('id');
  const url = `/tasks/${encodeURIComponent(taskId)}/recurrence`;
  const OPTIONS = [
    { value: '', label: 'None' },
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
  ];

  const label = document.createElement('label');
  label.htmlFor = 'recurrence-frequency';
  label.textContent = 'Repeats';
  const select = document.createElement('select');
  select.id = 'recurrence-frequency';
  // Declarative: one <option> per frequency
  select.append(...OPTIONS.map((option) => new Option(option.label, option.value)));
  const message = document.createElement('p');
  message.className = 'recurrence-message';
  message.setAttribute('role', 'status');
  section.append(label, select, message);

  const show = (state) => {
    select.value = state.isActive ? state.frequency : '';
  };

  async function load() {
    try {
      show(await api.get(url));
    } catch (error) {
      message.textContent = error.message;
    }
  }

  select.addEventListener('change', async () => {
    message.textContent = '';
    const frequency = select.value;
    try {
      show(frequency ? await api.put(url, { frequency }) : await api.delete(url));
      message.textContent = 'Saved';
    } catch (error) {
      message.textContent = error.message; // the server's text, e.g. only managers can change it
      await load(); // show the value the server really has
    }
  });

  load();
})();
