import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const bin = fileURLToPath(new URL('../bin/build-escape.mjs', import.meta.url));
const run = (args, input) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', input, timeout: 5000, env: { ...process.env, NO_COLOR: '1' } });

test('help, version and non-TTY default never wait for input', () => {
  for (const args of [[], ['--help'], ['--version']]) {
    const result = run(args); assert.equal(result.status, 0, result.stderr); assert.doesNotMatch(result.stdout, /\x1b/);
  }
  assert.match(run(['--help']).stdout, /no network, subprocesses/);
  assert.equal(run(['--version']).stdout, '1.0.0\n');
  assert.equal(run(['--unknown']).status, 2);
});

test('non-TTY demo verifies all three gates and is reproducible', () => {
  const first = run(['--demo']); const second = run(['--demo']);
  assert.equal(first.status, 0, first.stderr); assert.equal(first.stdout, second.stdout);
  assert.match(first.stdout, /3\/3 gates open/); assert.match(first.stdout, /Release shipped/);
  assert.doesNotMatch(first.stdout, /FAIL |\x1b/);
});

test('accessible plain mode supports piped play, recovery and clean EOF', () => {
  const result = run(['--plain'], '1\n\n3\n\n2\n\n4\n\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /FAIL/); assert.match(result.stdout, /3\/3 gates open; 4 patches tried/);
  assert.doesNotMatch(result.stdout, /\x1b/);
  const eof = run(['--plain'], ''); assert.equal(eof.status, 0); assert.match(eof.stdout, /Nothing was saved/);
});
