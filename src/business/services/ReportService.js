const { ForbiddenError, NotFoundError, ValidationError } = require('../errors/AppError');
const { TaskStatus } = require('../../domain/enums');
const ReportBuilder = require('../reports/ReportBuilder');
const { exporterFor } = require('../reports/exporters/exporterFor');
const { daysBetween } = require('../reports/isoWeek');
const { addDays, formatDate } = require('../rules/recurrence/utcDate');

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;
const WEEK_DAYS = 7;
const DUE_SOON_LIMIT = 6;
const PERCENT = 100;

const isRealDate = (text) =>
  typeof text === 'string' &&
  DATE_FORMAT.test(text) &&
  formatDate(new Date(`${text}T00:00:00Z`)) === text;

// "Website Relaunch" -> "website-relaunch", safe inside a file name
const slugOf = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'project';

const isOpen = (task) => task.status !== TaskStatus.DONE;
const progressOf = (done, total) => (total === 0 ? 0 : Math.round((done / total) * PERCENT));

/** FR7: project reports for managers (US7-1, US7-2) and the personal dashboard (US7-3). */
class ReportService {
  /**
   * @param {object} deps
   * @param {import('../../data-access/repositories/ReportRepository')} deps.reportRepository
   * @param {object} deps.projectRepository
   * @param {object} deps.taskRepository
   * @param {import('./AuthorizationService')} deps.authorizationService
   * @param {() => Date} [deps.clock] - tests pass a fixed date
   */
  constructor({
    reportRepository,
    projectRepository,
    taskRepository,
    authorizationService,
    clock = () => new Date(),
  }) {
    this.reportRepository = reportRepository;
    this.projectRepository = projectRepository;
    this.taskRepository = taskRepository;
    this.authorizationService = authorizationService;
    this.clock = clock;
  }

  /**
   * @param {{ id: number }} user
   * @param {number} projectId
   * @param {{ from?: string, to?: string }} [range] - YYYY-MM-DD, both optional
   * @returns {object} the frozen report built by ReportBuilder
   * requires: user is logged in
   * effects: throws, in this order, NotFoundError if the project does not exist,
   *          ForbiddenError if user is not its manager, ValidationError if the range is
   *          malformed, reversed or longer than 366 days; otherwise returns the report
   *          (no dates = the last 30 days up to today)
   * modifies: nothing
   */
  getProjectReport(user, projectId, range = {}) {
    const project = this.#findManagedProject(user, projectId);
    const today = this.#today();
    const { from, to } = this.#checkRange(range, today);
    const query = { projectId: project.id, from, to };

    return new ReportBuilder({ project, range: { from, to } })
      .withStatusBreakdown(this.reportRepository.countByStatus(query))
      .withCompletionTrend(this.reportRepository.countCompletedByDay(query))
      .withWorkload(this.reportRepository.workloadByAssignee(query))
      .withOverdue(this.reportRepository.findOverdue({ ...query, today }), today)
      .build();
  }

  /**
   * @param {{ id: number }} user
   * @param {number} projectId
   * @param {{ from?: string, to?: string, format: string }} request
   * @returns {{ fileName: string, contentType: string, body: string }}
   * requires: user is logged in
   * effects: same checks as getProjectReport, plus ValidationError for an unknown format;
   *          returns the file named taskflow-<project>-<today>.<extension>
   * modifies: nothing
   */
  exportProjectReport(user, projectId, { format, ...range }) {
    const exporter = exporterFor(format);
    const report = this.getProjectReport(user, projectId, range);
    return {
      fileName: `taskflow-${slugOf(report.project.name)}-${this.#today()}.${exporter.extension}`,
      contentType: exporter.contentType,
      body: exporter.export(report),
    };
  }

  /**
   * @param {{ id: number }} user
   * @returns {{ stats: object, dueSoon: object[], projects: object[] }}
   * requires: user is logged in
   * effects: counts only the user's own tasks: open (not DONE), due this week (open, due
   *          today to today + 6), overdue (open, due before today), done; lists at most 6
   *          open tasks, earliest due first; and every project of the user with its progress
   * modifies: nothing
   */
  getDashboard(user) {
    const today = this.#today();
    const weekEnd = addDays(today, WEEK_DAYS - 1);
    const projects = this.projectRepository.findByUser(user.id);
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const mine = this.taskRepository.findByAssignee(user.id);
    const open = mine.filter(isOpen);

    // Declarative: every number is a filter over my tasks
    return {
      stats: {
        open: open.length,
        dueThisWeek: open.filter((task) => task.dueDate >= today && task.dueDate <= weekEnd).length,
        overdue: open.filter((task) => task.dueDate < today).length,
        done: mine.length - open.length,
      },
      dueSoon: [...open]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id)
        .slice(0, DUE_SOON_LIMIT)
        .map((task) => ({ ...task, projectName: projectNames.get(task.projectId) ?? '' })),
      projects: projects.map((project) => this.#progressOf(project, user)),
    };
  }

  #findManagedProject(user, projectId) {
    const project = this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError(`Project ${projectId} not found`);
    if (!this.authorizationService.isManager(user.id, projectId)) {
      throw new ForbiddenError('Only the project manager can see its report');
    }
    return project;
  }

  #checkRange({ from, to }, today) {
    // Imperative: fill in the defaults, then one guard clause per rule
    const end = to ?? today;
    const start = from ?? addDays(end, 1 - DEFAULT_RANGE_DAYS);
    if (!isRealDate(start) || !isRealDate(end)) {
      throw new ValidationError('Dates must be real days written as YYYY-MM-DD');
    }
    if (start > end) throw new ValidationError('The start date must be on or before the end date');
    if (daysBetween(start, end) + 1 > MAX_RANGE_DAYS) {
      throw new ValidationError(`A report covers at most ${MAX_RANGE_DAYS} days`);
    }
    return { from: start, to: end };
  }

  #progressOf(project, user) {
    const tasks = this.taskRepository.findByProject(project.id);
    const done = tasks.filter((task) => !isOpen(task)).length;
    return {
      id: project.id,
      name: project.name,
      total: tasks.length,
      done,
      progress: progressOf(done, tasks.length),
      isManager: this.authorizationService.isManager(user.id, project.id),
    };
  }

  #today() {
    return formatDate(this.clock());
  }
}

module.exports = ReportService;
