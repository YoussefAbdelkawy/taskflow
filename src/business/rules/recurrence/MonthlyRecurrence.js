const RecurrenceStrategy = require('./RecurrenceStrategy');
const { parseDate, formatDate } = require('./utcDate');

// Day 0 of a month is the last day of the month before it.
const LAST_DAY_OF_PREVIOUS_MONTH = 0;

/**
 * Every month: the same day next month. If that day does not exist
 * (31 January -> February), the last day of next month instead.
 */
class MonthlyRecurrence extends RecurrenceStrategy {
  nextDueDate(dueDate) {
    const date = parseDate(dueDate);
    const year = date.getUTCFullYear();
    const nextMonth = date.getUTCMonth() + 1; // Date.UTC rolls month 12 into January
    const lastDay = new Date(
      Date.UTC(year, nextMonth + 1, LAST_DAY_OF_PREVIOUS_MONTH),
    ).getUTCDate();
    return formatDate(new Date(Date.UTC(year, nextMonth, Math.min(date.getUTCDate(), lastDay))));
  }
}

module.exports = MonthlyRecurrence;
