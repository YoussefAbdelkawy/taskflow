/**
 * FR7: read-only SQL aggregates for the project report (US7-1).
 *
 * It does not extend BaseRepository on purpose: a report is computed from the tasks
 * and history tables, it is never created, updated or deleted, so the CRUD contract
 * does not apply. Every query filters on (project_id, due_date), which uses
 * idx_tasks_project_due (NFR7).
 */
const IN_RANGE = 't.project_id = ? AND t.due_date BETWEEN ? AND ?';
const UNASSIGNED = 'Unassigned';

class ReportRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {{ projectId: number, from: string, to: string }} query - dates are YYYY-MM-DD
   * @returns {{ status: string, count: number }[]} only statuses that occur
   */
  countByStatus({ projectId, from, to }) {
    return this.db
      .prepare(
        `SELECT t.status, COUNT(*) AS count FROM tasks t WHERE ${IN_RANGE} GROUP BY t.status`,
      )
      .all(projectId, from, to)
      .map(({ status, count }) => ({ status, count }));
  }

  /**
   * @param {{ projectId: number, from: string, to: string }} query
   * @returns {{ day: string, count: number }[]} DONE changes per day, oldest day first
   */
  countCompletedByDay({ projectId, from, to }) {
    return this.db
      .prepare(
        `SELECT substr(h.changed_at, 1, 10) AS day, COUNT(*) AS count
         FROM task_status_history h
         JOIN tasks t ON t.id = h.task_id
         WHERE t.project_id = ? AND h.new_status = 'DONE'
           AND substr(h.changed_at, 1, 10) BETWEEN ? AND ?
         GROUP BY day
         ORDER BY day`,
      )
      .all(projectId, from, to)
      .map(({ day, count }) => ({ day, count }));
  }

  /**
   * @param {{ projectId: number, from: string, to: string }} query
   * @returns {{ assigneeId: number | null, name: string, open: number, done: number }[]}
   *          the busiest member first, unassigned tasks last
   */
  workloadByAssignee({ projectId, from, to }) {
    return this.db
      .prepare(
        `SELECT t.assignee_id, u.name,
                SUM(t.status <> 'DONE') AS open, SUM(t.status = 'DONE') AS done
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE ${IN_RANGE}
         GROUP BY t.assignee_id
         ORDER BY t.assignee_id IS NULL, open DESC, t.assignee_id`,
      )
      .all(projectId, from, to)
      .map((row) => ({
        assigneeId: row.assignee_id,
        name: row.name ?? UNASSIGNED,
        open: row.open,
        done: row.done,
      }));
  }

  /**
   * @param {{ projectId: number, from: string, to: string, today: string }} query
   * @returns {object[]} open tasks in the range due before today, oldest due date first
   */
  findOverdue({ projectId, from, to, today }) {
    return this.db
      .prepare(
        `SELECT t.id, t.title, u.name AS assignee_name, t.priority, t.status, t.due_date
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE ${IN_RANGE} AND t.status <> 'DONE' AND t.due_date < ?
         ORDER BY t.due_date, t.id`,
      )
      .all(projectId, from, to, today)
      .map((row) => ({
        id: row.id,
        title: row.title,
        assigneeName: row.assignee_name,
        priority: row.priority,
        status: row.status,
        dueDate: row.due_date,
      }));
  }
}

module.exports = ReportRepository;
