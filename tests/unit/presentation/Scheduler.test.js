const Scheduler = require('../../../src/presentation/scheduler/Scheduler');

describe('Scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const fakeService = () => ({ runDue: jest.fn(() => 0) });

  it('runs once immediately on start (covers a server restart), then every interval', () => {
    const recurrenceService = fakeService();
    const scheduler = new Scheduler({ recurrenceService, intervalMs: 60000 });

    scheduler.start();
    expect(recurrenceService.runDue).toHaveBeenCalledTimes(1);
    expect(recurrenceService.runDue.mock.calls[0][0]).toBeInstanceOf(Date);

    jest.advanceTimersByTime(60000);
    expect(recurrenceService.runDue).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(120000);
    expect(recurrenceService.runDue).toHaveBeenCalledTimes(4);
    scheduler.stop();
  });

  it('stop() clears the interval', () => {
    const recurrenceService = fakeService();
    const scheduler = new Scheduler({ recurrenceService, intervalMs: 60000 });

    scheduler.start();
    scheduler.stop();
    jest.advanceTimersByTime(600000);

    expect(recurrenceService.runDue).toHaveBeenCalledTimes(1);
  });

  it('logs an error from runDue without crashing and keeps running', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const recurrenceService = {
      runDue: jest.fn(() => {
        throw new Error('database is locked');
      }),
    };
    const scheduler = new Scheduler({ recurrenceService, intervalMs: 60000 });

    expect(() => scheduler.start()).not.toThrow();
    jest.advanceTimersByTime(60000);

    expect(recurrenceService.runDue).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });
});
