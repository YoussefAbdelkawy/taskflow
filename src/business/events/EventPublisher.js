/**
 * EventPublisher: the subject in the Observer pattern. Services publish task
 * events here, and every subscribed TaskObserver is told about them.
 * Delivery is synchronous: publish() returns after every observer has run.
 */
class EventPublisher {
  constructor() {
    this.observers = [];
  }

  /**
   * @param {import('./TaskObserver')} observer
   * effects: adds the observer once; subscribing it again does nothing
   * modifies: the list of observers
   */
  subscribe(observer) {
    if (this.observers.includes(observer)) return;
    this.observers.push(observer);
  }

  /**
   * @param {import('./TaskObserver')} observer
   * effects: the observer is not called for later events
   * modifies: the list of observers
   */
  unsubscribe(observer) {
    this.observers = this.observers.filter((current) => current !== observer);
  }

  /**
   * @param {{ type: string, task: object, actorId: number, occurredAt: string }} event
   * effects: calls observer.onTaskEvent(event) on every observer in subscription order;
   *          an observer that throws is logged and does not stop the others
   * modifies: nothing itself (observers may change their own data)
   */
  publish(event) {
    this.observers.forEach((observer) => {
      try {
        observer.onTaskEvent(event);
      } catch (error) {
        console.error(`${observer.constructor.name} failed on ${event.type}:`, error);
      }
    });
  }
}

module.exports = EventPublisher;
