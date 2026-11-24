/** HTTP in, JSON or a file out for FR7. The rules live in ReportService. */
class ReportController {
  constructor({ reportService }) {
    this.reportService = reportService;
  }

  // GET /api/projects/:id/report?from=YYYY-MM-DD&to=YYYY-MM-DD (both optional)
  getReport = (req, res) => {
    const { from, to } = req.query;
    res.json(this.reportService.getProjectReport(req.user, Number(req.params.id), { from, to }));
  };

  // GET /api/projects/:id/report.csv?from&to: a download, not a page
  exportCsv = (req, res) => {
    const { from, to } = req.query;
    const file = this.reportService.exportProjectReport(req.user, Number(req.params.id), {
      from,
      to,
      format: 'csv',
    });
    res.attachment(file.fileName).type(file.contentType).send(file.body);
  };

  getDashboard = (req, res) => {
    res.json(this.reportService.getDashboard(req.user));
  };
}

module.exports = ReportController;
