const { createRepositories } = require('./helpers');

describe('RecurrenceRuleRepository', () => {
  let rules;

  beforeEach(() => {
    ({ rules } = createRepositories());
  });

  it('create → findById round trip, with isActive as a boolean', () => {
    const created = rules.create({
      frequency: 'WEEKLY',
      isActive: true,
      lastGeneratedPeriod: null,
    });

    expect(created).toEqual({
      id: 1,
      frequency: 'WEEKLY',
      isActive: true,
      lastGeneratedPeriod: null,
    });
    expect(rules.findById(created.id)).toEqual(created);
  });

  it('updates, lists and deletes rules', () => {
    const created = rules.create({ frequency: 'DAILY', isActive: true, lastGeneratedPeriod: null });

    expect(
      rules.update(created.id, { isActive: false, lastGeneratedPeriod: '2026-11-03' }),
    ).toEqual({ ...created, isActive: false, lastGeneratedPeriod: '2026-11-03' });
    expect(rules.update(99, { isActive: false })).toBeNull();
    expect(rules.findAll()).toHaveLength(1);
    expect(rules.delete(created.id)).toBe(true);
    expect(rules.findById(created.id)).toBeNull();
  });

  it('findActive returns only active rules', () => {
    const active = rules.create({ frequency: 'DAILY', isActive: true, lastGeneratedPeriod: null });
    rules.create({ frequency: 'WEEKLY', isActive: false, lastGeneratedPeriod: null });

    expect(rules.findActive()).toEqual([active]);
  });
});
