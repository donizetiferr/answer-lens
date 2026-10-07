import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SHELL_FILES, stampShell, syncOffline } from '../scripts/sync-offline.mjs';

test('committed offline revision binds the actual shell and checking does not write', async () => {
  const before = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal((await syncOffline()).changed, false);
  assert.equal(await readFile(new URL('../sw.js', import.meta.url), 'utf8'), before);
});

test('each shipped shell asset and worker behavior changes the revision without a self-hash loop', async () => {
  const files = new Map(await Promise.all(SHELL_FILES.map(async path => [path, await readFile(new URL(`../${path}`, import.meta.url), 'utf8')])));
  const baseline = stampShell(files);
  assert.equal(stampShell(new Map([...files, ['sw.js', baseline.worker]])).worker, baseline.worker);
  for (const path of SHELL_FILES) {
    const changed = new Map(files); changed.set(path, files.get(path) + '\n/* different shell bytes */\n');
    assert.notEqual(stampShell(changed).revision, baseline.revision, path);
  }
  assert.throws(() => stampShell(new Map([['sw.js', 'unversioned worker']])), /marker/);
});
