const CREATED = 201;

/** HTTP in, JSON out for project creation and membership. */
class ProjectController {
  constructor({ projectService }) {
    this.projectService = projectService;
  }

  create = (req, res) => {
    const { name, description } = req.body ?? {};
    const project = this.projectService.createProject({ name, description }, req.user);
    res.status(CREATED).json(project);
  };

  listMine = (req, res) => {
    res.json(this.projectService.listMyProjects(req.user));
  };

  getById = (req, res) => {
    res.json(this.projectService.getProject(Number(req.params.id), req.user));
  };

  addMember = (req, res) => {
    const { email, role } = req.body ?? {};
    const member = this.projectService.addMember(
      { projectId: Number(req.params.id), email, role },
      req.user,
    );
    res.status(CREATED).json(member);
  };
}

module.exports = ProjectController;
