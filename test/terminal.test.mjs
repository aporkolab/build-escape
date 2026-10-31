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

test('interruptions report the signal; a plain quit reports none', async () => {
  for (const [stop, signal] of [[t => key(t, 'q'), null], [t => key(t, 'escape'), null], [t => key(t, 'c', { ctrl: true }), 'SIGINT'], [t => t.signals.emit('SIGINT'), 'SIGINT'], [t => t.signals.emit('SIGTERM'), 'SIGTERM']]) {
    const t = terminal(); stop(t);
    const outcome = await t.done;
    assert.equal(outcome.signal, signal); assert.equal(outcome.interrupted, signal !== null);
  }
});

test('hint toggles, out-of-range digits are ignored and replay restarts from gate one', async () => {
  const t = terminal();
  key(t, 'h'); assert.match(t.output.text, /Buddy: Try zero items/);
  key(t, '9'); key(t, '3'); key(t, 'return');
  assert.match(t.output.text, /PATCH VERIFIED/);
  key(t, 'return'); key(t, '2'); key(t, 'return'); key(t, 'return'); key(t, '4'); key(t, 'return'); key(t, 'return');
  assert.match(t.output.text, /ALL THREE GATES OPEN/);
  t.output.text = ''; key(t, 'r');
  assert.match(t.output.text, /Two branches\. One checkout\./);
  key(t, 'q');
  const outcome = await t.done;
  assert.equal(outcome.state.levelIndex, 0); assert.deepEqual(outcome.state.attempts, []);
});

test('a terminal shrunk below 80 x 24 asks to be widened instead of drawing a broken layout', async () => {
  const t = terminal();
  t.output.columns = 60; t.signals.emit('SIGWINCH');
  assert.match(t.output.text, /Please widen the terminal to 80 x 24/);
  key(t, 'q'); await t.done; assertRestored(t);
});

test('output errors restore terminal before rejecting', async () => {
  const t = terminal();
  const rejected = assert.rejects(t.done, /output gone/);
  t.output.emit('error', new Error('output gone'));
  await rejected; assertRestored(t);
});

test('streams without raw mode reject with a pointer to --plain', async () => {
  const input = new EventEmitter(); input.pause = () => {};
  await assert.rejects(runTerminalGame({ input, output: new Output(), signals: new EventEmitter() }), /--plain/);
});
