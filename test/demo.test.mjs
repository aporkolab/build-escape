import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDemo } from '../scripts/build-demo.mjs';

test('browser build ships the exact CLI engine and refreshes an old generated copy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'build-escape-demo-'));
  try {
    const engine = await readFile(new URL('../src/engine.mjs', import.meta.url));
    await mkdir(join(directory, 'src'));
    await mkdir(join(directory, 'docs'));
    await writeFile(join(directory, 'src/engine.mjs'), engine);
    await writeFile(join(directory, 'docs/engine.mjs'), 'old or divergent puzzle code');
    const result = await buildDemo(directory);
    assert.equal(result.engineBytes, engine.length);
    assert.deepEqual(await readFile(join(directory, 'docs/engine.mjs')), engine);
    assert.deepEqual(await readFile(join(directory, 'src/engine.mjs')), engine);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('syntax check discovers every module under the source directories', async () => {
  const { findModules } = await import('../scripts/check-syntax.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'build-escape-lint-'));
  try {
    await mkdir(join(directory, 'src/nested'), { recursive: true });
    await writeFile(join(directory, 'src/nested/a.mjs'), '');
    await writeFile(join(directory, 'src/notes.txt'), '');
    await mkdir(join(directory, 'node_modules'));
    await writeFile(join(directory, 'node_modules/ignored.mjs'), '');
    assert.deepEqual(await findModules(directory), [join(directory, 'src/nested/a.mjs')]);
    const own = await findModules();
    for (const file of ['bin/build-escape.mjs', 'src/engine.mjs', 'docs/app.mjs']) assert.ok(own.some(path => path.endsWith(file)), file);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
