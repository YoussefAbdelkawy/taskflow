const EventPublisher = require('../../../../src/business/events/EventPublisher');
const TaskObserver = require('../../../../src/business/events/TaskObserver');
const EventNames = require('../../../../src/business/events/eventNames');

class RecordingObserver extends TaskObserver {
  constructor(log, name) {
    super();
    this.log = log;
    this.name = name;
  }

  onTaskEvent(event) {
    this.log.push([this.name, event.type]);
  }
}

class ThrowingObserver extends TaskObserver {
  onTaskEvent() {
    throw new Error('observer failed');
  }
}

const completedEvent = () => ({
  type: EventNames.TASK_COMPLETED,
  task: { id: 1 },
  actorId: 2,
  occurredAt: '2026-11-02T09:00:00.000Z',
});

describe('eventNames', () => {
  it('lists the three task events, frozen', () => {
    expect(EventNames).toEqual({
      TASK_ASSIGNED: 'TASK_ASSIGNED',
      TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
      TASK_COMPLETED: 'TASK_COMPLETED',
    });
    expect(Object.isFrozen(EventNames)).toBe(true);
  });
});

describe('TaskObserver', () => {
  it('is an interface: onTaskEvent() throws until a subclass implements it', () => {
    class LazyObserver extends TaskObserver {}

    expect(() => new LazyObserver().onTaskEvent(completedEvent())).toThrow(
      'LazyObserver.onTaskEvent() is not implemented',
    );
  });
});

describe('EventPublisher', () => {
  let log;
  let publisher;

  beforeEach(() => {
    log = [];
    publisher = new EventPublisher();
  });

  it('calls all subscribers in subscription order', () => {
    publisher.subscribe(new RecordingObserver(log, 'first'));
    publisher.subscribe(new RecordingObserver(log, 'second'));

    publisher.publish(completedEvent());

    expect(log).toEqual([
      ['first', 'TASK_COMPLETED'],
      ['second', 'TASK_COMPLETED'],
    ]);
  });

  it('does not call an unsubscribed observer', () => {
    const leaving = new RecordingObserver(log, 'leaving');
    publisher.subscribe(leaving);
    publisher.subscribe(new RecordingObserver(log, 'staying'));

    publisher.unsubscribe(leaving);
    publisher.publish(completedEvent());

    expect(log).toEqual([['staying', 'TASK_COMPLETED']]);
  });

  it('keeps calling the others when one observer throws, and logs the error', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    publisher.subscribe(new ThrowingObserver());
    publisher.subscribe(new RecordingObserver(log, 'after'));

    publisher.publish(completedEvent());

    expect(log).toEqual([['after', 'TASK_COMPLETED']]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('calls an observer once even if it subscribes twice', () => {
    const observer = new RecordingObserver(log, 'twice');
    publisher.subscribe(observer);
    publisher.subscribe(observer);

    publisher.publish(completedEvent());

    expect(log).toEqual([['twice', 'TASK_COMPLETED']]);
  });
});
