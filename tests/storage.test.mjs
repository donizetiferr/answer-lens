import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySession, beginBlind } from '../src/core.js';
import { demoSession } from '../src/demo.js';
import { STORAGE_KEY, saveLocal, clearLocal, loadLocal } from '../src/storage.js';
class MemoryStorage {
  data = new Map(); calls = [];
  getItem(key) { this.calls.push(['get', key]); return this.data.get(key) ?? null; }
  setItem(key, value) { this.calls.push(['set', key]); this.data.set(key, value); }
  removeItem(key) { this.calls.push(['remove', key]); this.data.delete(key); }
  clear() { throw new Error('Unrelated site storage must never be cleared.'); }
}
test('saving is off by default and does not store draft text', () => {
  const storage = new MemoryStorage(); const session = demoSession();
  assert.equal(session.remember, false); assert.equal(saveLocal(session, () => storage).ok, true);
  assert.equal(storage.data.has(STORAGE_KEY), false); assert.equal(storage.calls.some(([call]) => call === 'set'), false);
});
test('opt-in local save roundtrips the same blind order and judgments', () => {
  const storage = new MemoryStorage(); const session = beginBlind(demoSession(true), { seed: 42, now: '2026-09-21T04:00:00.000Z' });
  session.ratings.A.clarity = 3;
  assert.equal(saveLocal(session, () => storage).ok, true);
  assert.deepEqual(loadLocal(() => storage).session, session);
  assert.deepEqual([...storage.data.keys()], [STORAGE_KEY]);
});
test('opting out deletes only the app key', () => {
  const storage = new MemoryStorage(); storage.setItem('another-app', 'keep');
  saveLocal(demoSession(true), () => storage); saveLocal(emptySession(), () => storage);
  assert.equal(storage.data.has(STORAGE_KEY), false); assert.equal(storage.getItem('another-app'), 'keep');
});
test('reset clears saved answers without deleting other storage', () => {
  const storage = new MemoryStorage(); storage.setItem('unrelated', 'preserved');
  saveLocal(demoSession(true), () => storage); assert.equal(clearLocal(() => storage).ok, true);
  assert.equal(loadLocal(() => storage).session, null); assert.equal(storage.getItem('unrelated'), 'preserved');
});
test('corrupt, oversized, future and non-consenting data are preserved, not auto-deleted', () => {
  for (const json of ['{broken', 'x'.repeat(600001), JSON.stringify(emptySession()), '{"version":999}']) {
    const storage = new MemoryStorage(); storage.setItem(STORAGE_KEY, json);
    const loaded = loadLocal(() => storage); assert.equal(loaded.ok, false); assert.equal(loaded.session, null);
    assert.equal(storage.getItem(STORAGE_KEY), json); assert.equal(loaded.protected, true); assert.match(loaded.message, /untouched/);
  }
});
test('storage access, quota and deletion failures are reported without throwing', () => {
  const getter = () => { throw new Error('Storage blocked'); };
  assert.equal(saveLocal(demoSession(true), getter).ok, false);
  assert.equal(clearLocal(getter).ok, false); assert.equal(loadLocal(getter).session, null);
  const quota = { setItem() { throw new Error('Quota'); }, removeItem() {} };
  assert.equal(saveLocal(demoSession(true), () => quota).ok, false);
});
test('saving invalid state never writes the storage key', () => {
  const storage = new MemoryStorage(); const session = demoSession(true); session.question = 1;
  assert.equal(saveLocal(session, () => storage).ok, false); assert.equal(storage.data.size, 0);
});
