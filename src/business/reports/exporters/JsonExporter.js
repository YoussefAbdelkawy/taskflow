const ReportExporter = require('./ReportExporter');

const INDENT = 2;

/** The whole report as JSON, for tools that read data rather than spreadsheets. */
class JsonExporter extends ReportExporter {
  constructor() {
    super({ contentType: 'application/json', extension: 'json' });
  }

  export(report) {
    return JSON.stringify(report, null, INDENT);
  }
}

module.exports = JsonExporter;
