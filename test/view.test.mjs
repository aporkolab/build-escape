import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { LEVELS, createGame, submitChoice, advance } from '../src/engine.mjs';
import { plainPuzzle, plainFeedback, summary, renderScreen } from '../src/view.mjs';
import { runPlainGame } from '../src/terminal.mjs';

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
const stateAt = levelIndex => ['compose', 'advance-clear'].slice(0, levelIndex).reduce((state, id) => advance(submitChoice(state, id)), createGame());

test('summary counts gates and pluralizes patches', () => {
  assert.equal(summary(createGame()), `BUILD ESCAPE: 0/${LEVELS.length} gates open; 0 patches tried.`);
  assert.equal(summary(submitChoice(createGame(), 'compose')), `BUILD ESCAPE: 0/${LEVELS.length} gates open; 1 patch tried.`);
});

test('plain puzzle numbers the gate, lists every patch and shows the hint only on request', () => {
  const text = plainPuzzle(createGame());
  assert.match(text, /^GATE 1\/3: SOURCE \| Two branches\. One checkout\./);
  LEVELS[0].choices.forEach((choice, index) => assert.ok(text.includes(`${index + 1}. ${choice.label}`)));
  assert.doesNotMatch(text, /Buddy's hint/);
  assert.match(plainPuzzle(createGame(), true), /Buddy's hint: Try zero items/);
});

test('plain feedback shows observed and expected values, with null as "rejected"', () => {
  const text = plainFeedback(submitChoice(createGame(), 'theirs').feedback);
  assert.match(text, /FAIL Zero items are rejected\n {5}observed: 0; expected: rejected/);
  assert.match(text, /PASS 20% off two \$10 items/);
  assert.ok(text.trimEnd().endsWith(LEVELS[0].failure));
});

test('every feedback screen, the hint screens and the final screen fit 80 x 24', () => {
  const screens = [];
  for (const [index, level] of LEVELS.entries()) {
    screens.push(renderScreen(stateAt(index), { width: 80, height: 24, colors: false, hint: true }));
    for (const choice of level.choices) screens.push(renderScreen(submitChoice(stateAt(index), choice.id), { width: 80, height: 24, colors: false }));
  }
  screens.push(renderScreen(advance(submitChoice(stateAt(2), 'bounded')), { width: 80, height: 24, colors: false }));
  for (const screen of screens) {
    const lines = screen.split('\n');
    assert.ok(lines.length <= 24, `${lines.length} lines`);
    assert.ok(lines.every(line => line.length === 80), 'every line is padded to the panel width');
  }
});

test('colored rendering keeps the same visible width as plain rendering', () => {
  const plain = renderScreen(createGame(), { width: 88, height: 30, colors: false }).split('\n');
  const colored = renderScreen(createGame(), { width: 88, height: 30, colors: true }).split('\n');
  assert.match(colored[0], ANSI);
  assert.deepEqual(colored.map(line => line.replace(ANSI, '').length), plain.map(line => line.length));
});

async function playPlain(lines) {
  const input = new PassThrough(); const output = new PassThrough(); let text = '';
  output.on('data', chunk => { text += chunk; });
  const done = runPlainGame({ input, output });
  input.end(lines.map(line => `${line}\n`).join(''));
  const outcome = await done;
  return { outcome, text };
}

test('plain mode explains invalid answers, shows hints and quits on Q without changing state', async () => {
  const { outcome, text } = await playPlain(['7', 'h', 'q']);
  assert.match(text, /Choose 1, 2, 3 or 4/);
  assert.match(text, /Buddy: Try zero items/);
  assert.equal(outcome.quit, true); assert.deepEqual(outcome.state, createGame());
});

test('plain mode completes the room and reports it as not quit', async () => {
  const { outcome, text } = await playPlain(['3', '', '2', '', '4', '']);
  assert.equal(outcome.quit, false); assert.equal(outcome.state.phase, 'complete');
  assert.match(text, /3\/3 gates open; 3 patches tried/);
});
