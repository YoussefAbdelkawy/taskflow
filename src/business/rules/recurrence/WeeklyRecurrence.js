const RecurrenceStrategy = require('./RecurrenceStrategy');
const { addDays } = require('./utcDate');

const DAYS_IN_WEEK = 7;

/** Every week: the next instance is due on the same weekday, 7 days later. */
class WeeklyRecurrence extends RecurrenceStrategy {
  nextDueDate(dueDate) {
    return addDays(dueDate, DAYS_IN_WEEK);
  }
}

module.exports = WeeklyRecurrence;
