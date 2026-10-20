// All settings and "magic numbers" live here, with a name (Lab 4: avoid magic numbers).
const path = require('node:path');

const DEFAULT_PORT = 3000;

module.exports = Object.freeze({
  port: Number(process.env.PORT) || DEFAULT_PORT,
  // ':memory:' = a throwaway database, used by the tests
  databasePath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'taskflow.db'),
});
