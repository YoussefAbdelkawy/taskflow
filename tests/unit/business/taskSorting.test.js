// FR5: sortByDueDate is a pure function, so it is tested without any repository.
const { sortByDueDate, SortOrder } = require('../../../src/business/rules/taskSorting');

const tasks = Object.freeze([
  Object.freeze({ id: 1, title: 'Middle', dueDate: '2026-11-10' }),
  Object.freeze({ id: 2, title: 'Latest', dueDate: '2026-12-01' }),
  Object.freeze({ id: 3, title: 'Earliest', dueDate: '2026-11-02' }),
]);

const titles = (list) => list.map((task) => task.title);

describe('sortByDueDate', () => {
  it('US5-2: ascending puts the earliest due date first', () => {
    expect(titles(sortByDueDate(tasks, SortOrder.ASC))).toEqual(['Earliest', 'Middle', 'Latest']);
  });

  it('descending puts the latest due date first', () => {
    expect(titles(sortByDueDate(tasks, SortOrder.DESC))).toEqual(['Latest', 'Middle', 'Earliest']);
  });

  it('returns a new array and leaves the original unchanged', () => {
    const before = titles(tasks);

    const sorted = sortByDueDate(tasks, SortOrder.ASC);

    expect(sorted).not.toBe(tasks);
    expect(titles(tasks)).toEqual(before);
  });

  it('keeps tasks with the same due date in a stable order (by id)', () => {
    const sameDay = [
      { id: 7, dueDate: '2026-11-02' },
      { id: 4, dueDate: '2026-11-02' },
    ];

    expect(sortByDueDate(sameDay, SortOrder.ASC).map((task) => task.id)).toEqual([4, 7]);
    expect(sortByDueDate(sameDay, SortOrder.DESC).map((task) => task.id)).toEqual([4, 7]);
  });

  it('returns an empty array for an empty list', () => {
    expect(sortByDueDate([], SortOrder.ASC)).toEqual([]);
  });

  it('SortOrder holds exactly asc and desc', () => {
    expect(Object.values(SortOrder)).toEqual(['asc', 'desc']);
    expect(Object.isFrozen(SortOrder)).toBe(true);
  });
});
