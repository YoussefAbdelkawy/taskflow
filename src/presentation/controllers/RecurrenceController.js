/** HTTP in, JSON out for FR2: GET / PUT / DELETE /api/tasks/:id/recurrence. */
class RecurrenceController {
  constructor({ recurrenceService }) {
    this.recurrenceService = recurrenceService;
  }

  get = (req, res) => {
    res.json(
      this.recurrenceService.getRecurrence({ taskId: Number(req.params.id), user: req.user }),
    );
  };

  set = (req, res) => {
    const { frequency } = req.body ?? {};
    res.json(
      this.recurrenceService.setRecurring({
        taskId: Number(req.params.id),
        frequency,
        user: req.user,
      }),
    );
  };

  turnOff = (req, res) => {
    res.json(this.recurrenceService.turnOff({ taskId: Number(req.params.id), user: req.user }));
  };
}

module.exports = RecurrenceController;
