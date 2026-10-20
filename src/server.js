// Entry point: `npm start` runs this file.
const config = require('./config');
const { createContainer } = require('./container');
const { createApp } = require('./app');

const container = createContainer({ databasePath: config.databasePath });
const app = createApp(container);

app.listen(config.port, () => {
  console.log(`TaskFlow is running on http://localhost:${config.port}`);
});

// The recurrence Scheduler (Youssef) will be started here later, e.g.
// container.scheduler.start();
