const { ValidationError } = require('../../errors/AppError');
const CsvExporter = require('./CsvExporter');
const JsonExporter = require('./JsonExporter');

// Lookup table instead of an if/else chain (same style as recurrence/strategyFor.js).
// A new format is one new exporter class and one line here.
const EXPORTERS = Object.freeze({
  csv: new CsvExporter(),
  json: new JsonExporter(),
});

/**
 * @param {string} format - "csv" or "json"
 * @returns {import('./ReportExporter')}
 * effects: returns the exporter; throws ValidationError for any other format
 * modifies: nothing
 */
function exporterFor(format) {
  if (!Object.hasOwn(EXPORTERS, format)) throw new ValidationError('Format must be csv or json');
  return EXPORTERS[format];
}

module.exports = { exporterFor };
