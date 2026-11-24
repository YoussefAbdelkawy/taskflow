// Pure helpers for ISO 8601 weeks (Monday first; week 1 holds the year's first Thursday).
const { parseDate, addDays } = require('../rules/recurrence/utcDate');

const DAYS_PER_WEEK = 7;
const THURSDAY = 4;
const MS_PER_DAY = 86400000;
const WEEK_DIGITS = 2;

/** @returns {string} the ISO week of a YYYY-MM-DD day, e.g. "2026-W47" */
function isoWeekOf(text) {
  const date = parseDate(text);
  // The Thursday of the same week decides the week's year
  const weekday = date.getUTCDay() || DAYS_PER_WEEK;
  date.setUTCDate(date.getUTCDate() + THURSDAY - weekday);
  const year = date.getUTCFullYear();
  const dayOfYear = (date - Date.UTC(year, 0, 1)) / MS_PER_DAY;
  const week = Math.floor(dayOfYear / DAYS_PER_WEEK) + 1;
  return `${year}-W${String(week).padStart(WEEK_DIGITS, '0')}`;
}

/** @returns {string[]} every ISO week touched by the range, in order, without repeats */
function weeksBetween(from, to) {
  const weeks = [];
  // Imperative: walk the range one week at a time, then add the last day's week
  for (let day = from; day <= to; day = addDays(day, DAYS_PER_WEEK)) weeks.push(isoWeekOf(day));
  weeks.push(isoWeekOf(to));
  return [...new Set(weeks)];
}

/** @returns {number} whole days from `from` to `to` (negative if `to` is earlier) */
const daysBetween = (from, to) => Math.round((parseDate(to) - parseDate(from)) / MS_PER_DAY);

module.exports = { isoWeekOf, weeksBetween, daysBetween };
