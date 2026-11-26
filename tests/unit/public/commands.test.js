// FR8 Command pattern: public/js/board/commands.js, run in a sandbox without a browser
// (like ui.test.js). A fake api and a fake board view record what each command does.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const COMMANDS_FILE = path.join(__dirname, '../../../public/js/board/commands.js');

function loadCommands() {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(`${fs.readFileSync(COMMANDS_FILE, 'utf8')}\nboardCommands;`, sandbox);
}

// Records every PATCH; refuses with the given error while `failNext` is set.
function fakeApi() {
  const api = {
    calls: [],
    failNext: null,
    async patch(url, body) {
      api.calls.push({ url, body });
      if (api.failNext) {
        const error = api.failNext;
        api.failNext = null;
        throw error;
      }
      return { id: Number(url.split('/')[2]), status: body.status };
    },
  };
  return api;
}

// Records where the board shows each card, in order.
function fakeView() {
  const view = {
    moves: [],
    moveCard(taskId, status) {
      view.moves.push([taskId, status]);
    },
  };
  return view;
}

const blocked = () => Object.assign(new Error('Task is blocked'), { status: 409 });

describe('public/js/board/commands.js', () => {
  const { MoveTaskCommand, CommandHistory } = loadCommands();
  let api;
  let view;
  const move = (from, to, taskId = 7) => new MoveTaskCommand({ api, view, taskId, from, to });

  beforeEach(() => {
    api = fakeApi();
    view = fakeView();
  });

  describe('MoveTaskCommand', () => {
    it('US8-1 execute moves the card first, then saves the new status', async () => {
      await move('TO_DO', 'IN_PROGRESS').execute();

      expect(view.moves).toEqual([[7, 'IN_PROGRESS']]);
      expect(api.calls).toEqual([{ url: '/tasks/7/status', body: { status: 'IN_PROGRESS' } }]);
    });

    it('US8-1 AC2 when the server refuses (409 blocked) the card snaps back and the error is passed on', async () => {
      api.failNext = blocked();

      await expect(move('TO_DO', 'DONE').execute()).rejects.toMatchObject({
        status: 409,
        message: 'Task is blocked',
      });
      expect(view.moves).toEqual([
        [7, 'DONE'],
        [7, 'TO_DO'],
      ]);
    });

    it('US8-1 AC3 undo moves the card back and saves the old status', async () => {
      const command = move('TO_DO', 'IN_PROGRESS');
      await command.execute();

      await command.undo();

      expect(view.moves).toEqual([
        [7, 'IN_PROGRESS'],
        [7, 'TO_DO'],
      ]);
      expect(api.calls[1]).toEqual({ url: '/tasks/7/status', body: { status: 'TO_DO' } });
    });

    it('US8-1 a failed undo puts the card back where it was and passes the error on', async () => {
      const command = move('TO_DO', 'IN_PROGRESS');
      await command.execute();
      api.failNext = Object.assign(new Error('Cannot reach the server'), { status: 0 });

      await expect(command.undo()).rejects.toThrow('Cannot reach the server');
      expect(view.moves.at(-1)).toEqual([7, 'IN_PROGRESS']);
    });

    it('US8-1 a drop on the same column does nothing (no request, no move)', async () => {
      await move('DONE', 'DONE').execute();

      expect(api.calls).toEqual([]);
      expect(view.moves).toEqual([]);
    });

    it('NFR8 describes itself for the aria-live announcement', () => {
      expect(move('TO_DO', 'IN_PROGRESS').describe()).toEqual({
        taskId: 7,
        from: 'TO_DO',
        to: 'IN_PROGRESS',
      });
    });
  });

  describe('CommandHistory', () => {
    let history;

    beforeEach(() => {
      history = new CommandHistory();
    });

    it('US8-1 AC3 run executes a command and Undo reverses the last one', async () => {
      await history.run(move('TO_DO', 'IN_PROGRESS'));
      expect(history.canUndo()).toBe(true);

      await history.undo();

      expect(api.calls.map((call) => call.body.status)).toEqual(['IN_PROGRESS', 'TO_DO']);
      expect(history.canUndo()).toBe(false);
    });

    it('US8-1 AC3 undoes in reverse order (last move first)', async () => {
      await history.run(move('TO_DO', 'IN_PROGRESS', 1));
      await history.run(move('TO_DO', 'DONE', 2));

      await history.undo();
      await history.undo();

      expect(api.calls.slice(2)).toEqual([
        { url: '/tasks/2/status', body: { status: 'TO_DO' } },
        { url: '/tasks/1/status', body: { status: 'TO_DO' } },
      ]);
    });

    it('US8-1 AC2 a refused move is not remembered, so Undo has nothing to undo', async () => {
      api.failNext = blocked();

      await expect(history.run(move('TO_DO', 'DONE'))).rejects.toMatchObject({ status: 409 });

      expect(history.canUndo()).toBe(false);
    });

    it('US8-1 a failed undo keeps the move, so the user can try Undo again', async () => {
      await history.run(move('TO_DO', 'IN_PROGRESS'));
      api.failNext = Object.assign(new Error('Cannot reach the server'), { status: 0 });

      await expect(history.undo()).rejects.toThrow('Cannot reach the server');
      expect(history.canUndo()).toBe(true);

      await history.undo();
      expect(history.canUndo()).toBe(false);
      expect(api.calls.at(-1).body).toEqual({ status: 'TO_DO' });
    });

    it('US8-1 Undo with nothing to undo does nothing', async () => {
      await history.undo();

      expect(api.calls).toEqual([]);
      expect(view.moves).toEqual([]);
    });

    it('US8-1 run returns what the command returned (the saved task)', async () => {
      await expect(history.run(move('TO_DO', 'DONE'))).resolves.toEqual({ id: 7, status: 'DONE' });
    });
  });
});
