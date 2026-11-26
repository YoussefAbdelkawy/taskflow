/** HTTP in, JSON out for FR1. Ids from the URL and body become numbers; the rules live in TaskService. */
const CREATED = 201;
const NO_CONTENT = 204;

class TaskController {
  constructor({ taskService }) {
    this.taskService = taskService;
  }

  create = (req, res) => {
    const { title, description, assigneeId, dueDate, priority } = req.body ?? {};
    const task = this.taskService.createTask(
      {
        projectId: Number(req.params.projectId),
        title,
        description,
        assigneeId: Number(assigneeId),
        dueDate,
        priority,
      },
      req.user,
    );
    res.status(CREATED).json(task);
  };

  listByProject = (req, res) => {
    res.json(this.taskService.listProjectTasks(Number(req.params.projectId), req.user));
  };

  listAssignees = (req, res) => {
    res.json(this.taskService.listAssignees(Number(req.params.projectId), req.user));
  };

  listMine = (req, res) => {
    res.json(this.taskService.listMyTasks(req.user));
  };

  getById = (req, res) => {
    res.json(this.taskService.getTask(Number(req.params.id), req.user));
  };

  changeStatus = (req, res) => {
    const { status } = req.body ?? {};
    res.json(
      this.taskService.changeStatus({ taskId: Number(req.params.id), status, user: req.user }),
    );
  };

  // FR8 US8-2: only the fields that were sent are passed on; an assigneeId becomes a number
  update = (req, res) => {
    const { title, description, priority, dueDate, assigneeId } = req.body ?? {};
    const changes = {
      title,
      description,
      priority,
      dueDate,
      assigneeId: assigneeId === undefined ? undefined : Number(assigneeId),
    };
    res.json(
      this.taskService.updateTask({ taskId: Number(req.params.id), changes, user: req.user }),
    );
  };

  // FR8 US8-3
  remove = (req, res) => {
    this.taskService.deleteTask(Number(req.params.id), req.user);
    res.status(NO_CONTENT).end();
  };

  // FR5: GET /api/tasks?priority=HIGH&status=TO_DO&sort=asc (all optional).
  // An empty value (the page's "All" option) means "no filter"; the service checks the rest.
  filterTasks = (req, res) => {
    const { priority, status, sort } = req.query;
    const optional = (value) => (value === '' ? undefined : value);
    res.json(
      this.taskService.getTasks(
        { priority: optional(priority), status: optional(status) },
        optional(sort),
        req.user,
      ),
    );
  };

  getHistory = (req, res) => {
    res.json(this.taskService.getHistory(Number(req.params.id), req.user));
  };
}

module.exports = TaskController;
