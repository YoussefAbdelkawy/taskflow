const RecurrenceStrategy = require('../../../../src/business/rules/recurrence/RecurrenceStrategy');
const DailyRecurrence = require('../../../../src/business/rules/recurrence/DailyRecurrence');
const WeeklyRecurrence = require('../../../../src/business/rules/recurrence/WeeklyRecurrence');
const MonthlyRecurrence = require('../../../../src/business/rules/recurrence/MonthlyRecurrence');
const { strategyFor } = require('../../../../src/business/rules/recurrence/strategyFor');
const { ValidationError } = require('../../../../src/business/errors/AppError');

describe('RecurrenceStrategy', () => {
  it('is an interface: nextDueDate() throws until a subclass implements it', () => {
    expect(() => new RecurrenceStrategy().nextDueDate('2026-03-01')).toThrow('not implemented');
  });
});

describe('recurrence strategies', () => {
  it('daily: 2026-03-01 → 2026-03-02', () => {
    expect(new DailyRecurrence().nextDueDate('2026-03-01')).toBe('2026-03-02');
  });

  it('daily: crosses month and year ends', () => {
    expect(new DailyRecurrence().nextDueDate('2026-02-28')).toBe('2026-03-01');
    expect(new DailyRecurrence().nextDueDate('2026-12-31')).toBe('2027-01-01');
  });

  it('weekly: 2026-11-02 → 2026-11-09 (both Mondays)', () => {
    const next = new WeeklyRecurrence().nextDueDate('2026-11-02');

    expect(next).toBe('2026-11-09');
    expect(new Date(`${next}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it.each([
    ['2026-01-31', '2026-02-28'],
    ['2028-01-31', '2028-02-29'],
    ['2026-12-15', '2027-01-15'],
    ['2026-03-31', '2026-04-30'],
  ])('monthly: %s → %s', (from, to) => {
    expect(new MonthlyRecurrence().nextDueDate(from)).toBe(to);
  });

  it('does not change the input string', () => {
    const dueDate = '2026-01-31';

    new MonthlyRecurrence().nextDueDate(dueDate);

    expect(dueDate).toBe('2026-01-31');
  });
});

describe('strategyFor', () => {
  it.each([
    ['DAILY', DailyRecurrence],
    ['WEEKLY', WeeklyRecurrence],
    ['MONTHLY', MonthlyRecurrence],
  ])('returns the %s strategy', (frequency, Strategy) => {
    expect(strategyFor(frequency)).toBeInstanceOf(Strategy);
  });

  it.each(['YEARLY', 'weekly', undefined, 'toString'])(
    'throws ValidationError for an unknown frequency (%s)',
    (frequency) => {
      expect(() => strategyFor(frequency)).toThrow(new ValidationError('Unknown frequency'));
    },
  );
});
