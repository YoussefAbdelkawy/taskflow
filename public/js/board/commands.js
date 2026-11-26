/* exported boardCommands */
// FR8 Command pattern: every move of a card on the board is an object that can do and undo
// itself. Drag-and-drop, keyboard moves (NFR8) and the toast's "Undo" (US8-1 AC3) all go
// through these two classes, so the server call, the snap-back and the error path exist once.
// Pure (no DOM): the board passes in the api and a view with moveCard(taskId, status).
const boardCommands = (() => {
  /** One status change of one task, e.g. TO_DO → IN_PROGRESS. */
  class MoveTaskCommand {
    /**
     * @param {{ api: { patch: Function }, view: { moveCard: Function }, taskId: number,
     *           from: string, to: string }} move
     */
    constructor({ api, view, taskId, from, to }) {
      this.api = api;
      this.view = view;
      this.taskId = taskId;
      this.from = from;
      this.to = to;
    }

    /** Moves the card to `to` and saves it; on refusal the card snaps back and the error is rethrown. */
    execute() {
      return this.#moveTo(this.to, this.from);
    }

    /** Moves the card back to `from` and saves that; on failure it stays where it was. */
    undo() {
      return this.#moveTo(this.from, this.to);
    }

    /** What the aria-live region announces (NFR8). */
    describe() {
      return { taskId: this.taskId, from: this.from, to: this.to };
    }

    // Optimistic update: show the move at once, save it, put the card back if the server says no
    async #moveTo(status, fallback) {
      if (status === fallback) return null; // dropped on its own column
      this.view.moveCard(this.taskId, status);
      try {
        return await this.api.patch(`/tasks/${this.taskId}/status`, { status });
      } catch (error) {
        this.view.moveCard(this.taskId, fallback);
        throw error; // the board shows the toast (409 blocked, 403, 0 = offline)
      }
    }
  }

  /** Remembers the moves that succeeded, so "Undo" can reverse the last one. */
  class CommandHistory {
    #done = [];

    /** Executes the command; only a move the server accepted is remembered. */
    async run(command) {
      const result = await command.execute();
      this.#done.push(command);
      return result;
    }

    /** Undoes the last remembered move; if that fails it stays remembered, so Undo can be retried. */
    async undo() {
      const last = this.#done.at(-1);
      if (!last) return;
      await last.undo();
      this.#done.pop();
    }

    canUndo() {
      return this.#done.length > 0;
    }
  }

  return { MoveTaskCommand, CommandHistory };
})();
