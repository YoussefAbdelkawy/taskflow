// npm run test:api: API regression tests. Starts the seeded E2E server (port 3100), runs the
// Postman collection against it with Newman, then stops the server. Exit code 1 if a check fails.
const path = require('node:path');
const newman = require('newman');

const COLLECTION = path.join(
  __dirname,
  '..',
  'docs',
  'postman',
  'TaskFlow.postman_collection.json',
);

const server = require('./e2e-server');

server.on('listening', () => {
  const { port } = server.address();
  newman.run(
    {
      collection: require(COLLECTION),
      envVar: [{ key: 'baseUrl', value: `http://localhost:${port}` }],
      reporters: 'cli',
    },
    (error, summary) => {
      server.close();
      const failures = summary?.run.failures.length ?? 1;
      if (error || failures > 0) process.exitCode = 1;
    },
  );
});
