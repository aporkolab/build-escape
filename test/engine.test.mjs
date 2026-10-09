import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, createGame, submitChoice, advance, evaluateChoice, quoteTotal, simulateTimer, simulateRetry } from '../src/engine.mjs';

test('each gate has exactly one working patch and every other patch produces concrete failing evidence', () => {
  for (const level of LEVELS) {
    const results = level.choices.map(choice => evaluateChoice(level.id, choice.id));
    assert.equal(results.filter(result => result.passed).length, 1, level.id);
    for (const result of results.filter(result => !result.passed)) assert.ok(result.checks.some(check => !check.passed));
  }
});

test('incorrect patches are recoverable and reducers never modify old state', () => {
  let state = createGame();
  for (const level of LEVELS) {
    for (const choice of level.choices.filter(candidate => !evaluateChoice(level.id, candidate.id).passed)) {
      const before = structuredClone(state);
      const failed = submitChoice(state, choice.id);
      assert.deepEqual(state, before);
      assert.equal(failed.feedback.passed, false);
      assert.equal(advance(failed).levelIndex, state.levelIndex);
      state = advance(failed);
    }
    const winner = level.choices.find(choice => evaluateChoice(level.id, choice.id).passed);
    state = advance(submitChoice(state, winner.id));
  }
  assert.equal(state.phase, 'complete');
  assert.deepEqual(state.solved, ['merge', 'timer', 'retry']);
  assert.equal(state.attempts.length, 12);
  assert.equal(advance(state), state);
  assert.equal(submitChoice(state, 'bounded'), state);
});

test('merge model preserves the guard, discount and rounding order', () => {
  assert.equal(quoteTotal('compose', 10, 2, 0.2), 16);
  assert.equal(quoteTotal('compose', 0.004, 3, 0), 0.01);
  assert.equal(quoteTotal('round-first', 0.004, 3, 0), 0);
  for (const quantity of [-5, 0, 0.5, 1.2]) assert.equal(quoteTotal('compose', 10, quantity, 0), null);
  assert.equal(quoteTotal('compose', 49.99, 3, 1), 0);
  assert.equal(quoteTotal('ours', 10, 2, 0.2), 20);
  assert.equal(quoteTotal('theirs', 10, 0, 0.2), 0);
});

test('timer model demonstrates unbounded draining, early cancellation and leaked intervals', () => {
  assert.deepEqual(simulateTimer('advance-clear'), { beats: 3, pending: 0, bounded: true, now: 3000 });
  assert.equal(simulateTimer('more-time').bounded, false);
  assert.equal(simulateTimer('more-time').pending, 1);
  assert.equal(simulateTimer('clear-first').beats, 0);
  assert.equal(simulateTimer('one-pass').beats, 1);
  assert.equal(simulateTimer('one-pass').pending, 1);
});

test('retry model obeys attempt, classification and delay invariants across status sequences', () => {
  for (const first of [200, 400, 429, 503]) for (const second of [200, 400, 429, 503]) for (const third of [200, 400, 429, 503]) {
    const trace = simulateRetry('bounded', [first, second, third]);
    assert.ok(trace.attempts.length <= 3);
    assert.ok(trace.waits.length < trace.attempts.length);
    assert.equal(trace.stopped, true);
    const firstTerminal = [first, second, third].findIndex(code => code === 200 || code === 400);
    assert.equal(trace.attempts.length, firstTerminal === -1 ? 3 : firstTerminal + 1);
    assert.equal(trace.success, trace.attempts.at(-1) === 200);
    assert.deepEqual(trace.waits, [200, 400].slice(0, trace.attempts.length - 1));
  }
  assert.equal(simulateRetry('recursive', [503]).stopped, false);
});

test('repeated inputs are deterministic and invalid patches cannot execute arbitrary text', () => {
  for (const level of LEVELS) for (const choice of level.choices) assert.deepEqual(evaluateChoice(level.id, choice.id), evaluateChoice(level.id, choice.id));
  for (const input of ['$(id)', ';rm -rf /', 'constructor', '__proto__', undefined]) assert.throws(() => evaluateChoice('merge', input), RangeError);
  assert.throws(() => simulateRetry('bounded', []), TypeError);
  assert.throws(() => simulateRetry('bounded', [NaN]), TypeError);
});
