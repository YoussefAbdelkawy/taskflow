// FR7 Builder pattern: the report is assembled section by section, then frozen.
const ReportBuilder = require('../../../../src/business/reports/ReportBuilder');

const PROJECT = { id: 1, name: 'Website' };
const RANGE = { from: '2026-11-02', to: '2026-11-22' }; // Monday of ISO week 45 to Sunday of week 47

const builder = () => new ReportBuilder({ project: PROJECT, range: RANGE });

describe('ReportBuilder (US7-1)', () => {
  it('US7-1 an empty build has every section empty and isEmpty = true (AC3)', () => {
    const report = builder().build();

    expect(report).toMatchObject({
      project: PROJECT,
      range: RANGE,
      isEmpty: true,
      summary: { total: 0, done: 0, open: 0, overdue: 0, completionRate: 0 },
      workload: [],
      overdue: [],
    });
    expect(report.statusBreakdown).toEqual([
      { status: 'TO_DO', count: 0 },
      { status: 'IN_PROGRESS', count: 0 },
      { status: 'DONE', count: 0 },
    ]);
  });

  it('US7-1 status breakdown is zero-filled in status order and drives the summary', () => {
    const report = builder()
      .withStatusBreakdown([
        { status: 'DONE', count: 3 },
        { status: 'TO_DO', count: 1 },
      ])
      .build();

    expect(report.statusBreakdown).toEqual([
      { status: 'TO_DO', count: 1 },
      { status: 'IN_PROGRESS', count: 0 },
      { status: 'DONE', count: 3 },
    ]);
    expect(report.summary).toMatchObject({ total: 4, done: 3, open: 1, completionRate: 75 });
    expect(report.isEmpty).toBe(false);
  });

  it('US7-1 completion trend groups days into ISO weeks and keeps empty weeks', () => {
    const report = builder()
      .withCompletionTrend([
        { day: '2026-11-02', count: 2 },
        { day: '2026-11-08', count: 1 },
        { day: '2026-11-22', count: 4 },
      ])
      .build();

    expect(report.completionTrend).toEqual([
      { week: '2026-W45', count: 3 },
      { week: '2026-W46', count: 0 },
      { week: '2026-W47', count: 4 },
    ]);
  });

  it('US7-1 ISO week numbers are right across a year boundary', () => {
    const report = new ReportBuilder({
      project: PROJECT,
      range: { from: '2026-12-28', to: '2027-01-04' },
    })
      .withCompletionTrend([{ day: '2027-01-01', count: 1 }])
      .build();

    // 2027-01-01 is a Friday, so it still belongs to 2026-W53
    expect(report.completionTrend).toEqual([
      { week: '2026-W53', count: 1 },
      { week: '2027-W01', count: 0 },
    ]);
  });

  it('US7-1 overdue rows get daysLate and set summary.overdue', () => {
    const report = builder()
      .withOverdue([{ id: 7, title: 'Late', dueDate: '2026-11-18' }], '2026-11-20')
      .build();

    expect(report.overdue).toEqual([{ id: 7, title: 'Late', dueDate: '2026-11-18', daysLate: 2 }]);
    expect(report.summary.overdue).toBe(1);
  });

  it('US7-1 workload is copied as given', () => {
    const workload = [{ assigneeId: 2, name: 'Karim', open: 2, done: 1 }];

    expect(builder().withWorkload(workload).build().workload).toEqual(workload);
  });

  it('US7-1 the built report is deeply frozen (immutable)', () => {
    const report = builder()
      .withWorkload([{ assigneeId: 2, name: 'Karim', open: 1, done: 0 }])
      .build();

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.workload[0])).toBe(true);
    expect(Object.isFrozen(report.summary)).toBe(true);
  });

  it('US7-1 each with… call returns the builder, so calls can be chained in any order', () => {
    const first = builder();

    expect(first.withOverdue([], '2026-11-20')).toBe(first);
    expect(first.withWorkload([])).toBe(first);
  });
});
