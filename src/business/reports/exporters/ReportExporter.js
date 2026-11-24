/**
 * FR7 Strategy pattern: the contract every report exporter follows.
 * A subclass sets contentType and extension and implements export(report).
 */
class ReportExporter {
  constructor({ contentType, extension }) {
    this.contentType = contentType;
    this.extension = extension;
  }

  /**
   * @param {object} _report - built by ReportBuilder
   * @returns {string} the file content
   */
  export(_report) {
    throw new Error(`${this.constructor.name}.export() is not implemented`);
  }
}

module.exports = ReportExporter;
