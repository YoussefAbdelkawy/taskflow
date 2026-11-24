const ReportExporter = require('./ReportExporter');

// RFC 4180: lines end with CRLF; a field with a comma, quote or line break is quoted,
// and a quote inside it is doubled.
const LINE_END = '\r\n';
const NEEDS_QUOTES = /[",\r\n]/;

const escapeField = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

// US7-2 AC3: the same columns, in the same order, as the overdue table on reports.html
const COLUMNS = Object.freeze([
  ['ID', (row) => `TF-${row.id}`],
  ['Title', (row) => row.title],
  ['Assignee', (row) => row.assigneeName],
  ['Priority', (row) => row.priority],
  ['Status', (row) => row.status],
  ['Due date', (row) => row.dueDate],
  ['Days late', (row) => row.daysLate],
]);

/** US7-2: the overdue table as a CSV file that opens in Excel or Google Sheets. */
class CsvExporter extends ReportExporter {
  constructor() {
    super({ contentType: 'text/csv; charset=utf-8', extension: 'csv' });
  }

  export(report) {
    // Declarative: header + one line per row, each cell escaped
    const header = COLUMNS.map(([title]) => title);
    const rows = report.overdue.map((row) => COLUMNS.map(([, read]) => read(row)));
    return [header, ...rows].map((cells) => cells.map(escapeField).join(',') + LINE_END).join('');
  }
}

module.exports = CsvExporter;
