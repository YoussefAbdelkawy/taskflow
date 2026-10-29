/**
 * TaskObserver: the Observer interface from the Milestone 1 class diagram.
 * Anything that wants to react to task events extends this class and
 * implements onTaskEvent(event).
 *
 * event = { type, task, actorId, occurredAt }, where type is one of eventNames.
 */
class TaskObserver {
  /**
   * @param {{ type: string, task: object, actorId: number, occurredAt: string }} _event
   * effects: reacts to the event
   */
  onTaskEvent(_event) {
    throw new Error(`${this.constructor.name}.onTaskEvent() is not implemented`);
  }
}

module.exports = TaskObserver;
