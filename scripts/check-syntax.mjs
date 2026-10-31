import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative, join } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRECTORIES = ['bin', 'src', 'scripts', 'test', 'docs'];

/** Parse every shipped and test module without running it; dependency-free lint gate. */
export async function findModules(root = projectRoot) {
  const modules = [];
  for (const directory of SOURCE_DIRECTORIES) {
    const entries = await readdir(join(root, directory), { recursive: true, withFileTypes: true }).catch(() => []);
    for (const entry of entries) if (entry.isFile() && entry.name.endsWith('.mjs')) modules.push(join(entry.parentPath ?? entry.path, entry.name));
  }
  return modules.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const modules = await findModules();
  const failures = modules.filter(file => {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) process.stderr.write(result.stderr);
    return result.status !== 0;
  });
  console.log(`Syntax check: ${modules.length - failures.length}/${modules.length} modules parse.`);
  if (failures.length) process.exitCode = 1;
}
