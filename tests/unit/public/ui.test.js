// Pure helpers of public/js/ui.js, run in a sandbox without a browser (like api.test.js).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const UI_FILE = path.join(__dirname, '../../../public/js/ui.js');

function loadUi() {
  const sandbox = { Intl, Date };
  vm.createContext(sandbox);
  return vm.runInContext(`${fs.readFileSync(UI_FILE, 'utf8')}\nui;`, sandbox);
}

const TODAY = '2026-11-24'; // a Tuesday

describe('public/js/ui.js', () => {
  const ui = loadUi();

  // Equivalence classes + boundary values for relative due dates (DESIGN.md §8)
  it.each([
    ['5 days late', '2026-11-19', { text: '5d late', isLate: true }],
    ['1 day late (boundary)', '2026-11-23', { text: '1d late', isLate: true }],
    ['today', TODAY, { text: 'Today', isLate: false }],
    ['tomorrow', '2026-11-25', { text: 'Tomorrow', isLate: false }],
    ['2 days ahead → weekday', '2026-11-26', { text: 'Thu', isLate: false }],
    ['6 days ahead (last weekday)', '2026-11-30', { text: 'Mon', isLate: false }],
    ['7 days ahead → day and month', '2026-12-01', { text: '1 Dec', isLate: false }],
    ['next year', '2027-01-12', { text: '12 Jan 2027', isLate: false }],
  ])('formatDue: %s', (_case, dueDate, expected) => {
    expect(ui.formatDue(dueDate, TODAY)).toEqual(expected);
  });

  it('formatDue never calls a done task late', () => {
    expect(ui.formatDue('2026-11-19', TODAY, { isDone: true })).toEqual({
      text: '19 Nov',
      isLate: false,
    });
  });

  it.each([
    ['Mona', 'MO'],
    ['Mona Adel', 'MA'],
    ['  karim   salah  ', 'KS'],
    ['', '?'],
    [null, '?'],
  ])('initials(%p) = %p', (name, expected) => {
    expect(ui.initials(name)).toBe(expected);
  });

  it.each([
    ['TO_DO', 'To do', 'bg-status-todo'],
    ['IN_PROGRESS', 'In progress', 'bg-status-progress'],
    ['DONE', 'Done', 'bg-status-done'],
    ['BLOCKED', 'Blocked', 'bg-status-blocked'],
  ])('status %s is labelled "%s" with %s', (status, label, dotClass) => {
    expect(ui.STATUS[status]).toEqual({ label, dotClass });
  });

  it.each([
    ['HIGH', 'High', 'outline'],
    ['MEDIUM', 'Medium', 'secondary'],
    ['LOW', 'Low', 'secondary'],
  ])('priority %s is a "%s" badge with variant %s', (priority, label, variant) => {
    expect(ui.PRIORITY[priority]).toEqual({ label, variant });
  });

  it('greeting depends on the hour', () => {
    expect([5, 12, 18, 23].map((hour) => ui.greeting(hour))).toEqual([
      'Good morning',
      'Good afternoon',
      'Good evening',
      'Good evening',
    ]);
  });

  it('todayIso gives the local calendar day as YYYY-MM-DD', () => {
    expect(ui.todayIso(new Date(2026, 10, 24, 23, 30))).toBe('2026-11-24');
  });
});
