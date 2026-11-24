const { TaskStatus } = require('../../domain/enums');
const { isoWeekOf, weeksBetween, daysBetween } = require('./isoWeek');

const PERCENT = 100;

// Lab 3: immutability. The finished report cannot be changed by whoever receives it.
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

/**
 * FR7 Builder pattern: assembles a project report section by section.
 *
 * Why a builder: a report has a fixed core (project, range) and optional sections
 * (status breakdown, completion trend, workload, overdue) that are computed from
 * different queries. Without it, ReportService would need one constructor with
 * many positional arguments or a long if-chain deciding which sections exist.
 * Each with…() step is small and testable on its own, sections left out stay
 * empty, and build() derives the summary once and returns a frozen object.
 * A new section (e.g. "by priority") is one more with…() method; nothing else changes.
 */
class ReportBuilder {
  /** @param {{ project: { id: number, name: string }, range: { from: string, to: string } }} core */
  constructor({ project, range }) {
    this.project = { id: project.id, name: project.name };
    this.range = { ...range };
    this.statusRows = [];
    this.dayRows = [];
    this.workload = [];
    this.overdue = [];
  }

  /** @param {{ status: string, count: number }[]} rows - from ReportRepository.countByStatus */
  withStatusBreakdown(rows) {
    this.statusRows = rows;
    return this;
  }

  /** @param {{ day: string, count: number }[]} rows - from ReportRepository.countCompletedByDay */
  withCompletionTrend(rows) {
    this.dayRows = rows;
    return this;
  }

  /** @param {object[]} rows - from ReportRepository.workloadByAssignee */
  withWorkload(rows) {
    this.workload = rows.map((row) => ({ ...row }));
    return this;
  }

  /**
   * @param {object[]} rows - from ReportRepository.findOverdue
   * @param {string} today - YYYY-MM-DD
   */
  withOverdue(rows, today) {
    this.overdue = rows.map((row) => ({ ...row, daysLate: daysBetween(row.dueDate, today) }));
    return this;
  }

  /** @returns {object} the finished, deeply frozen report */
  build() {
    const statusBreakdown = this.#statusBreakdown();
    // Declarative: totals from the breakdown with reduce/find, no counters
    const total = statusBreakdown.reduce((sum, row) => sum + row.count, 0);
    const done = statusBreakdown.find((row) => row.status === TaskStatus.DONE).count;
    return deepFreeze({
      project: this.project,
      range: this.range,
      isEmpty: total === 0,
      summary: {
        total,
        done,
        open: total - done,
        overdue: this.overdue.length,
        completionRate: total === 0 ? 0 : Math.round((done / total) * PERCENT),
      },
      statusBreakdown,
      completionTrend: this.#completionTrend(),
      workload: this.workload,
      overdue: this.overdue,
    });
  }

  // Every status appears once, in workflow order, even with no tasks
  #statusBreakdown() {
    const counts = new Map(this.statusRows.map(({ status, count }) => [status, count]));
    return Object.values(TaskStatus).map((status) => ({ status, count: counts.get(status) ?? 0 }));
  }

  // Every week of the range appears, so the chart has no gaps
  #completionTrend() {
    const perWeek = this.dayRows.reduce((totals, { day, count }) => {
      const week = isoWeekOf(day);
      return { ...totals, [week]: (totals[week] ?? 0) + count };
    }, {});
    return weeksBetween(this.range.from, this.range.to).map((week) => ({
      week,
      count: perWeek[week] ?? 0,
    }));
  }
}

module.exports = ReportBuilder;
