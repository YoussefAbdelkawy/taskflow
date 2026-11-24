module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // tests/e2e runs in a real browser with Playwright (npm run test:e2e), not in Jest
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/e2e/'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  // npm run check fails if coverage drops below these (it was 97 / 88 / 96 / 98 at the start of M3)
  coverageThreshold: {
    global: { statements: 95, branches: 85, functions: 95, lines: 95 },
  },
};
