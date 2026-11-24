// FR7 Strategy pattern: the export format picks the exporter (US7-2).
const { exporterFor } = require('../../../../src/business/reports/exporters/exporterFor');
const CsvExporter = require('../../../../src/business/reports/exporters/CsvExporter');
const JsonExporter = require('../../../../src/business/reports/exporters/JsonExporter');
const { ValidationError } = require('../../../../src/business/errors/AppError');

const overdueRow = (overrides = {}) => ({
  id: 3,
  title: 'Fix the login bug',
  assigneeName: 'Omar',
  priority: 'HIGH',
  status: 'TO_DO',
  dueDate: '2026-11-18',
  daysLate: 2,
  ...overrides,
});

const reportWith = (overdue) => ({ project: { id: 1, name: 'Website' }, overdue });

describe('exporterFor (US7-2)', () => {
  it.each([
    ['csv', CsvExporter],
    ['json', JsonExporter],
  ])('US7-2 "%s" gives the matching exporter', (format, Exporter) => {
    expect(exporterFor(format)).toBeInstanceOf(Exporter);
  });

  it.each(['pdf', '', undefined, 'CSV ', 'toString'])(
    'US7-2 rejects the unknown format %p with a ValidationError',
    (format) => {
      expect(() => exporterFor(format)).toThrow(ValidationError);
    },
  );
});

describe('CsvExporter (US7-2)', () => {
  const lines = (overdue) => new CsvExporter().export(reportWith(overdue)).split('\r\n');

  it('US7-2 AC3 has the same columns as the on-screen overdue table', () => {
    expect(lines([])[0]).toBe('ID,Title,Assignee,Priority,Status,Due date,Days late');
  });

  it('US7-2 writes one CRLF-terminated line per row', () => {
    const csv = new CsvExporter().export(reportWith([overdueRow()]));

    expect(csv).toBe(
      'ID,Title,Assignee,Priority,Status,Due date,Days late\r\n' +
        'TF-3,Fix the login bug,Omar,HIGH,TO_DO,2026-11-18,2\r\n',
    );
  });

  // Equivalence classes for a title (RFC 4180): plain, comma, quote, new line, empty
  it.each([
    ['plain text stays as it is', 'Plain', 'Plain'],
    ['a comma is quoted', 'Design, build', '"Design, build"'],
    ['a quote is doubled and quoted', 'Say "hi"', '"Say ""hi"""'],
    ['a new line is quoted', 'Line 1\nLine 2', '"Line 1\nLine 2"'],
    ['a carriage return is quoted', 'A\rB', '"A\rB"'],
    ['an empty value stays empty', '', ''],
  ])('US7-2 AC2 %s', (_case, title, expected) => {
    const csv = new CsvExporter().export(reportWith([overdueRow({ title })]));

    expect(csv).toContain(`TF-3,${expected},Omar,`);
  });

  it('US7-2 an unassigned row has an empty Assignee cell', () => {
    expect(lines([overdueRow({ assigneeName: null })])[1]).toBe(
      'TF-3,Fix the login bug,,HIGH,TO_DO,2026-11-18,2',
    );
  });

  it('US7-2 CSV metadata: text/csv and the .csv extension', () => {
    expect(new CsvExporter()).toMatchObject({
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
    });
  });
});

describe('JsonExporter (US7-2)', () => {
  it('US7-2 writes the whole report as JSON', () => {
    const report = reportWith([overdueRow()]);
    const exporter = new JsonExporter();

    expect(JSON.parse(exporter.export(report))).toEqual(report);
    expect(exporter).toMatchObject({ contentType: 'application/json', extension: 'json' });
  });
});
