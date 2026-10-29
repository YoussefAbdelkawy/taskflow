const {
  TaskStatus,
  Priority,
  Role,
  Frequency,
  NotificationType,
} = require('../../../src/domain/enums');

describe('domain enums', () => {
  it.each([
    ['TaskStatus', TaskStatus, ['TO_DO', 'IN_PROGRESS', 'DONE']],
    ['Priority', Priority, ['LOW', 'MEDIUM', 'HIGH']],
    ['Role', Role, ['MANAGER', 'MEMBER']],
    ['Frequency', Frequency, ['DAILY', 'WEEKLY', 'MONTHLY']],
    ['NotificationType', NotificationType, ['ASSIGNED', 'DUE_SOON', 'OVERDUE']],
  ])('%s has exactly the agreed values, each equal to its key', (_name, values, expected) => {
    expect(Object.keys(values)).toEqual(expected);
    expect(Object.values(values)).toEqual(expected);
  });

  it('is frozen, so assigning a new key has no effect', () => {
    TaskStatus.IN_REVIEW = 'IN_REVIEW';
    Frequency.YEARLY = 'YEARLY';

    expect(Object.isFrozen(TaskStatus)).toBe(true);
    expect(TaskStatus.IN_REVIEW).toBeUndefined();
    expect(Frequency.YEARLY).toBeUndefined();
  });
});
