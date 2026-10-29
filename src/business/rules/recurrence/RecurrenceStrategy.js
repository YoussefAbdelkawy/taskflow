/**
 * RecurrenceStrategy: the Strategy interface from the Milestone 1 class diagram.
 * Each frequency (daily, weekly, monthly) is one subclass that knows how to move a
 * due date forward. Dates are "YYYY-MM-DD" text in and out; the input is never changed.
 */
class RecurrenceStrategy {
  /**
   * @param {string} _dueDate - "YYYY-MM-DD"
   * @returns {string} the next due date, "YYYY-MM-DD"
   */
  nextDueDate(_dueDate) {
    throw new Error(`${this.constructor.name}.nextDueDate() is not implemented`);
  }
}

module.exports = RecurrenceStrategy;
