// Bind the offline cache to the shell bytes. No runtime dependency or build step.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

export const SHELL_FILES = Object.freeze(['index.html', 'styles.css', 'icon.svg', 'sw.js',
  'src/app.js', 'src/core.js', 'src/storage.js', 'src/demo.js', 'src/output.js']);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const revision = /-shell-[a-f0-9]{64}/g;

export function stampShell(files) {
  const worker = files.get('sw.js');
  if (!worker || [...worker.matchAll(revision)].length !== 1) throw new Error('Offline cache revision marker must appear exactly once.');
  const digest = createHash('sha256');
  for (const [path, content] of [...files].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const bytes = path === 'sw.js' ? content.replace(revision, '-shell-REVISION') : content;
    // Length-delimited entries bind paths and bytes without concatenation ambiguity.
    digest.update(JSON.stringify([path, bytes]));
  }
  const hash = digest.digest('hex');
  return { worker: worker.replace(revision, `-shell-${hash}`), revision: hash };
}

export async function syncOffline({ write = false, root = ROOT } = {}) {
  const files = new Map(await Promise.all(SHELL_FILES.map(async path => [path, await readFile(join(root, path), 'utf8')])));
  const stamped = stampShell(files);
  const changed = stamped.worker !== files.get('sw.js');
  if (changed && !write) throw new Error('Offline shell revision is stale. Review runtime changes, then run node scripts/sync-prototype.mjs --write.');
  if (changed) await writeFile(join(root, 'sw.js'), stamped.worker);
  return { revision: stamped.revision, changed, mode: write ? 'write' : 'check' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => !['--check', '--write'].includes(arg))) throw new Error('Usage: node scripts/sync-offline.mjs [--check|--write]');
    console.log(JSON.stringify(await syncOffline({ write: args[0] === '--write' })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
