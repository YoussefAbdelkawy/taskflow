// FR5: sorting a task list by due date. Pure: same input → same output, the input is never changed.

/** The two sort orders the API accepts (?sort=asc | ?sort=desc). */
const SortOrder = Object.freeze({ ASC: 'asc', DESC: 'desc' });

// Due dates are YYYY-MM-DD text, so comparing the text compares the dates
const byDueDateAsc = (a, b) => a.dueDate.localeCompare(b.dueDate);

/**
 * @param {{ id: number, dueDate: string }[]} tasks
 * @param {'asc' | 'desc'} order - SortOrder.ASC (earliest first) or SortOrder.DESC (latest first)
 * @returns {object[]} a new array, sorted by due date; tasks due the same day stay in id order
 * requires: every task has a dueDate in YYYY-MM-DD form
 * effects: returns a sorted copy
 * modifies: nothing (the input array and its tasks are left unchanged)
 */
function sortByDueDate(tasks, order) {
  const direction = order === SortOrder.DESC ? -1 : 1;
  // Declarative: describe the order (date, then id) and let sort do the work, on a copy
  return [...tasks].sort((a, b) => direction * byDueDateAsc(a, b) || a.id - b.id);
}

module.exports = { sortByDueDate, SortOrder };
