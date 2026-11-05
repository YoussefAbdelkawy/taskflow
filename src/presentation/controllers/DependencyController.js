const CREATED = 201;

/** HTTP in, JSON out for FR6. The rules live in DependencyService. */
class DependencyController {
  constructor({ dependencyService }) {
    this.dependencyService = dependencyService;
  }

  create = (req, res) => {
    const dependency = this.dependencyService.addDependency({
      taskId: Number(req.params.id),
      dependsOnId: Number(req.body?.dependsOnId),
      user: req.user,
    });
    res.status(CREATED).json(dependency);
  };

  list = (req, res) => {
    res.json(this.dependencyService.getDependencies(Number(req.params.id), req.user));
  };
}

module.exports = DependencyController;
