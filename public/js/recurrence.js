/* global api, ui */
// FR2 widget in the task's properties panel: "Repeats: Never / Daily / Weekly / Monthly",
// with the next copy's due date under it. Managers can change it; members only see it.
// Renders into <section id="recurrence">; does nothing on pages without it.
(() => {
  const section = document.getElementById('recurrence');
  if (!section) return;

  const taskId = new URLSearchParams(location.search).get('id');
  const url = `/tasks/${encodeURIComponent(taskId)}/recurrence`;
  const OPTIONS = [
    { value: '', label: 'Never' },
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
  ];

  const select = ui.el('select', {
    className: 'select input',
    attrs: { id: 'recurrence-frequency', name: 'frequency' },
  });
  // Declarative: one <option> per frequency
  select.append(...OPTIONS.map((option) => new Option(option.label, option.value)));
  const next = ui.el('p', {
    className: 'text-xs text-muted-foreground',
    attrs: { id: 'recurrence-next', 'aria-live': 'polite' },
  });
  const message = ui.el('p', {
    className: 'recurrence-message text-xs text-destructive',
    attrs: { role: 'status' },
  });
  section.classList.add('field');
  section.replaceChildren(
    ui.el(
      'label',
      { className: 'flex items-center gap-2', attrs: { for: 'recurrence-frequency' } },
      ui.icon('repeat', 'text-muted-foreground'),
      'Repeats',
    ),
    select,
    next,
    message,
  );

  const show = (state) => {
    select.value = state.isActive ? state.frequency : '';
    next.textContent = state.nextDueDate
      ? `Next copy due ${ui.formatDue(state.nextDueDate).text} (${state.nextDueDate})`
      : 'Does not repeat';
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
    select.disabled = true;
    try {
      await (frequency ? api.put(url, { frequency }) : api.delete(url));
      ui.toast({
        category: 'success',
        title: frequency
          ? `Repeats ${select.selectedOptions[0].label.toLowerCase()}`
          : 'No longer repeats',
      });
    } catch (error) {
      message.textContent = error.message; // the server's text, e.g. only managers can change it
    } finally {
      select.disabled = false;
      await load(); // show the value (and next date) the server really has
    }
  });

  load();
})();
