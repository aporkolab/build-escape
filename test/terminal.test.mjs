import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runTerminalGame } from '../src/terminal.mjs';
import { renderScreen } from '../src/view.mjs';
import { createGame, submitChoice, advance } from '../src/engine.mjs';

class Input extends EventEmitter {
  isRaw = false;
  history = [];
  setRawMode(value) { this.isRaw = value; this.history.push(value); }
  resume() { this.resumed = true; }
  pause() { this.resumed = false; }
}
class Output extends EventEmitter {
  columns = 80; rows = 24; text = '';
  write(value) { this.text += value; }
}
function terminal() {
  const input = new Input(); const output = new Output(); const signals = new EventEmitter();
  const done = runTerminalGame({ input, output, signals, colors: false });
  return { input, output, signals, done };
}
const key = (t, name, extra = {}) => t.input.emit('keypress', '', { name, ...extra });
function assertRestored(t) {
  assert.equal(t.input.isRaw, false); assert.equal(t.input.resumed, false);
  assert.deepEqual(t.input.history, [true, false]);
  assert.match(t.output.text, /\x1b\[\?25h\x1b\[\?1049l$/);
  assert.equal(t.input.listenerCount('keypress'), 0);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGWINCH', 'exit']) assert.equal(t.signals.listenerCount(signal), 0);
}

test('arrows, numeric selection and Enter complete the game; normal exit restores terminal', async () => {
  const t = terminal();
  key(t, 'down'); key(t, 'down'); key(t, 'return'); key(t, 'return');
  key(t, '2'); key(t, 'return'); key(t, 'return');
  key(t, '4'); key(t, 'return'); key(t, 'return');
  key(t, 'return');
  const outcome = await t.done;
  assert.equal(outcome.state.phase, 'complete'); assert.equal(outcome.quit, false);
  assertRestored(t);
});

test('quit, Ctrl+C, SIGINT, SIGTERM and input EOF all restore raw mode and cursor', async () => {
  for (const stop of [t => key(t, 'q'), t => key(t, 'c', { ctrl: true }), t => t.signals.emit('SIGINT'), t => t.signals.emit('SIGTERM'), t => t.input.emit('end')]) {
    const t = terminal(); stop(t); assert.equal((await t.done).quit, true); assertRestored(t);
  }
});

test('input errors restore terminal before rejecting', async () => {
  const t = terminal();
  const rejected = assert.rejects(t.done, /stream failed/);
  t.input.emit('error', new Error('stream failed'));
  await rejected; assertRestored(t);
});

test('existing raw mode is restored rather than assumed false', async () => {
  const input = new Input(); input.isRaw = true;
  const output = new Output(); const signals = new EventEmitter();
  const done = runTerminalGame({ input, output, signals });
  input.emit('keypress', '', { name: 'q' }); await done;
  assert.equal(input.isRaw, true);
});

test('compact normal screens fit 80 columns and plain rendering contains no ANSI colors', () => {
  let state = createGame();
  for (const answer of ['compose', 'advance-clear', 'bounded']) {
    const screen = renderScreen(state, { width: 80, height: 24, colors: false });
    assert.doesNotMatch(screen, /\x1b/);
    assert.ok(screen.split('\n').every(line => line.length <= 80));
    assert.ok(screen.split('\n').length <= 24);
    state = advance(submitChoice(state, answer));
  }
});
