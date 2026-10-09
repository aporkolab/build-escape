import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Copy the exact tested CLI engine; the browser owns no second puzzle implementation. */
export async function buildDemo(root = projectRoot) {
  const source = await readFile(resolve(root, 'src/engine.mjs'));
  const output = resolve(root, 'docs');
  await mkdir(output, { recursive: true });
  const temporary = resolve(output, 'engine.mjs.tmp');
  await writeFile(temporary, source);
  await rename(temporary, resolve(output, 'engine.mjs'));
  return { directory: output, engineBytes: source.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildDemo().then(({ engineBytes }) => console.log(`Build Escape browser demo ready in docs/ (${engineBytes} engine bytes, copied unchanged).`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
