const RecurrenceStrategy = require('./RecurrenceStrategy');
const { addDays } = require('./utcDate');

const DAYS_IN_STEP = 1;

/** Every day: the next instance is due one day later. */
class DailyRecurrence extends RecurrenceStrategy {
  nextDueDate(dueDate) {
    return addDays(dueDate, DAYS_IN_STEP);
  }
}

module.exports = DailyRecurrence;
