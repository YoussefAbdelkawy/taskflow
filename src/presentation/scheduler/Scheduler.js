/**
 * The Scheduler (timer) actor from the use case diagram. Every intervalMs it asks
 * RecurrenceService to create the instances whose due date has passed. It also runs once
 * right away on start, so instances missed while the server was down are created on restart.
 */
class Scheduler {
  constructor({ recurrenceService, notificationService = null, intervalMs }) {
    this.recurrenceService = recurrenceService;
    this.notificationService = notificationService;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  /** effects: runs now, then every intervalMs; calling it twice does not start a second timer */
  start() {
    if (this.timer) return;
    this.runOnce();
    this.timer = setInterval(() => this.runOnce(), this.intervalMs);
  }

  /** effects: no more runs until start() is called again */
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  runOnce() {
    const now = new Date();
    try {
      this.recurrenceService.runDue(now);
    } catch (error) {
      console.error('Scheduler: creating recurring tasks failed:', error); // keep the server running
    }
    if (!this.notificationService) return;
    try {
      this.notificationService.sendReminders(now);
    } catch (error) {
      console.error('Scheduler: sending reminders failed:', error);
    }
  }
}

module.exports = Scheduler;
