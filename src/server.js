// Entry point: `npm start` runs this file.
const config = require('./config');
const { createContainer } = require('./container');
const { createApp } = require('./app');

const container = createContainer({ databasePath: config.databasePath });
const app = createApp(container);

app.listen(config.port, () => {
  console.log(`TaskFlow is running on http://localhost:${config.port}`);
});

// FR2: create recurring task instances on a timer (runs once now, then every minute).
// Only the real server starts it; tests never do.
container.scheduler.start();
