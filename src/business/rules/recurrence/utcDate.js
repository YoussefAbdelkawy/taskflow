// Pure helpers for due dates stored as text "YYYY-MM-DD".
// All math is done in UTC, so the server's time zone can never shift a day.
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;

/** @returns {Date} midnight UTC of that day (a new object every call) */
const parseDate = (text) => {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** @returns {string} "YYYY-MM-DD" of the UTC day */
const formatDate = (date) => date.toISOString().slice(0, ISO_DATE_LENGTH);

/** @returns {string} the date `days` later, as "YYYY-MM-DD" */
const addDays = (text, days) => {
  const date = parseDate(text);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
};

module.exports = { parseDate, formatDate, addDays };
