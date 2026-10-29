const { Frequency } = require('../../../domain/enums');
const { ValidationError } = require('../../errors/AppError');
const DailyRecurrence = require('./DailyRecurrence');
const WeeklyRecurrence = require('./WeeklyRecurrence');
const MonthlyRecurrence = require('./MonthlyRecurrence');

// Lookup table instead of an if/else chain: Frequency value -> its strategy.
const STRATEGIES = Object.freeze({
  [Frequency.DAILY]: new DailyRecurrence(),
  [Frequency.WEEKLY]: new WeeklyRecurrence(),
  [Frequency.MONTHLY]: new MonthlyRecurrence(),
});

/**
 * @param {string} frequency - a Frequency value
 * @returns {import('./RecurrenceStrategy')}
 * effects: returns the strategy for the frequency; throws ValidationError('Unknown frequency')
 *          for anything else
 * modifies: nothing
 */
function strategyFor(frequency) {
  if (!Object.hasOwn(STRATEGIES, frequency)) throw new ValidationError('Unknown frequency');
  return STRATEGIES[frequency];
}

module.exports = { strategyFor };
