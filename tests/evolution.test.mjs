import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptySession, beginBlind, setRating, lockAndReveal, nextPair, exportResult, importResult, migrateV1, validateSession } from '../src/core.js';
import { demoSession } from '../src/demo.js';
import { decisionNote, preferredAnswer, ratingText } from '../src/output.js';
import { STORAGE_KEY, LEGACY_KEY, saveLocal, clearLocal, loadLocal, loadLegacy } from '../src/storage.js';
import * as v1 from './fixtures/v1/core.js';
import * as v1Storage from './fixtures/v1/storage.js';
const start = '2026-09-21T07:00:00.000Z', end = '2026-09-21T07:01:00.000Z';
const blind = () => beginBlind(demoSession(), { seed: 1, now: start });
const result = () => lockAndReveal(blind(), 'B', 'The steps help with this question.', end);
class MemoryStorage {
  data = new Map(); writes = [];
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.writes.push(['set', key]); this.data.set(key, value); }
  removeItem(key) { this.writes.push(['remove', key]); this.data.delete(key); }
  clear() { throw new Error('Never clear unrelated storage'); }
}
export function legacyResult() {
  let s = { ...v1.emptySession(), synthetic: true, question: 'Which set of instructions is easier to use?', inputs: [{ origin: 'Synthetic original one', text: 'First complete synthetic answer.' }, { origin: 'Synthetic original two', text: 'Second complete synthetic answer.' }] };
  s = v1.beginBlind(s, { seed: 1, now: start });
  for (const label of v1.LABELS) for (const metric of v1.METRICS) s = v1.setRating(s, label, metric, metric === 'factualConfidence' ? 'unsure' : 4);
  return v1.lockAndReveal(s, 'B', 'A synthetic v1 fixture.', end);
}

test('quick verdict has no manufactured ratings or winner calculation', () => {
  const s = result(); assert.deepEqual(s.ratings, { A: {}, B: {} });
  assert.equal(s.phase, 'revealed'); assert.equal(s.verdict, 'B');
  assert.equal(importResult(exportResult(s)).verdict, 'B');
  assert.equal(ratingText(undefined), 'Not rated'); assert.equal(ratingText('unsure'), 'Not sure');
});
test('v2 zero, partial and full ratings each roundtrip without defaults', () => {
  for (const count of [0, 1, 3, 6]) {
    let s = blind(); let n = 0;
    for (const label of ['A', 'B']) for (const metric of ['usefulness', 'clarity', 'factualConfidence']) {
      if (n++ < count) s = setRating(s, label, metric, metric === 'factualConfidence' ? 'unsure' : 4);
    }
    s = lockAndReveal(s, 'tie', '', end);
    assert.deepEqual(importResult(exportResult(s)).ratings, s.ratings);
    assert.equal(exportResult(importResult(exportResult(s))), exportResult(s));
  }
});
test('invalid supplied ratings cannot be locked or smuggled through a partial import', () => {
  const s = blind(); s.ratings.A.clarity = 0;
  assert.throws(() => lockAndReveal(s, 'A', '', end), /rating/);
  const parsed = JSON.parse(exportResult(result())); parsed.comparison.ratings.B.clarity = 'unsure';
  assert.throws(() => importResult(JSON.stringify(parsed)), /rating/);
});
test('all newly copied and exported results require a locked verdict', () => {
  for (const s of [emptySession(), blind()]) for (const fn of [decisionNote, preferredAnswer, exportResult, nextPair]) assert.throws(() => fn(s));
  for (const verdict of [null, '', 'automatic']) assert.throws(() => lockAndReveal(blind(), verdict, '', end));
});
test('decision note preserves reason, both user-supplied origins and honest omissions', () => {
  const text = decisionNote(result());
  assert.match(text, /personal decision note/); assert.match(text, /SYNTHETIC DEMO/);
  assert.match(text, /You preferred Answer B/); assert.match(text, /The steps help/);
  assert.match(text, /Answer A: Synthetic example 2/); assert.match(text, /Answer B: Synthetic example 1/);
  assert.equal((text.match(/: Not rated/g) || []).length, 6);
  assert.match(text, /not a model ranking/); assert.match(text, /Sources are not authenticated/);
});
test('preferred answer follows the recorded mapping and labels synthetic content', () => {
  const s = result(); assert.equal(preferredAnswer(s), 'SYNTHETIC EXAMPLE — not a measured model output.\n\n' + s.inputs[0].text);
  s.synthetic = false; assert.equal(preferredAnswer(s), s.inputs[0].text);
  for (const verdict of ['tie', 'neither']) assert.throws(() => preferredAnswer({ ...s, verdict }));
});
test('text outputs preserve hostile-looking content as plain strings', () => {
  const s = result(); const text = '<img src=https://invalid.example/x onerror=alert(1)>\n<script>bad()</script>';
  s.inputs[0].text = text; s.note = text; s.synthetic = false;
  assert.equal(preferredAnswer(s), text); assert.ok(decisionNote(s).includes(text));
  assert.equal(importResult(exportResult(s)).note, text);
});
test('next pair retains exactly the question, not consent, answers, source names or demo status', () => {
  const s = result(); s.remember = true;
  const next = nextPair(s);
  assert.deepEqual(next, { ...emptySession(), question: s.question });
  assert.equal(s.phase, 'revealed'); assert.equal(s.remember, true);
});
test('an actual old v1 export migrates to v2 without changing its verdict or ratings', () => {
  const old = legacyResult(); const json = v1.exportResult(old); const upgraded = importResult(json);
  assert.equal(upgraded.version, 2); assert.equal(upgraded.phase, 'revealed'); assert.equal(upgraded.remember, false);
  for (const field of ['question', 'inputs', 'randomization', 'ratings', 'verdict', 'note', 'synthetic', 'lockedAt']) assert.deepEqual(upgraded[field], old[field]);
  assert.equal(JSON.parse(exportResult(upgraded)).schema, 'answer-lens-result/2');
});
test('v1 partial ratings stay invalid under the original v1 contract', () => {
  const old = legacyResult(); delete old.ratings.A.clarity;
  assert.throws(() => migrateV1(old), /complete ratings/);
  assert.throws(() => importResult(JSON.stringify({ schema: 'answer-lens-result/1', assessment: 'human-self-report', comparison: old })), /complete ratings/);
});
test('schema and session version mismatches or future versions are refused', () => {
  const data = JSON.parse(exportResult(result()));
  data.schema = 'answer-lens-result/1'; assert.throws(() => importResult(JSON.stringify(data)));
  data.schema = 'answer-lens-result/2'; data.comparison.version = 3; assert.throws(() => importResult(JSON.stringify(data)));
  assert.throws(() => validateSession({ ...result(), version: 1 }));
});
test('explicit v1 local migration reads but does not write or clear either key', () => {
  const storage = new MemoryStorage(); const old = legacyResult(); old.remember = true;
  v1Storage.saveLocal(old, () => storage); const bytes = storage.getItem(LEGACY_KEY); storage.writes = [];
  const migrated = loadLegacy(() => storage);
  assert.equal(migrated.ok, true); assert.equal(migrated.session.remember, false);
  assert.equal(storage.getItem(LEGACY_KEY), bytes); assert.equal(storage.getItem(STORAGE_KEY), null); assert.deepEqual(storage.writes, []);
});
test('actual old v1 loader, saver and reset cannot touch new v2 partial data', () => {
  const storage = new MemoryStorage(); const s = result(); s.remember = true;
  saveLocal(s, () => storage, null); const v2Bytes = storage.getItem(STORAGE_KEY);
  assert.equal(v1Storage.loadLocal(() => storage).session, null);
  const old = legacyResult(); old.remember = true; v1Storage.saveLocal(old, () => storage);
  v1Storage.loadLocal(() => storage); v1Storage.clearLocal(() => storage);
  assert.equal(storage.getItem(STORAGE_KEY), v2Bytes);
  assert.deepEqual(loadLocal(() => storage).session.ratings, { A: {}, B: {} });
});
test('v2 save and reset leave a concurrently updated v1 key alone', () => {
  const storage = new MemoryStorage(); const old = legacyResult(); old.remember = true;
  v1Storage.saveLocal(old, () => storage); const oldBytes = storage.getItem(LEGACY_KEY);
  const s = result(); s.remember = true; const saved = saveLocal(s, () => storage, null);
  assert.equal(clearLocal(() => storage, saved.raw).ok, true);
  assert.equal(storage.getItem(LEGACY_KEY), oldBytes); assert.deepEqual(v1Storage.loadLocal(() => storage).session, old);
});
test('unsupported v2 records survive reads, saves and reset attempts byte-for-byte', () => {
  for (const bytes of ['{bad', '{"version":3,"private":"future data"}', 'x'.repeat(600001)]) {
    const storage = new MemoryStorage(); storage.setItem(STORAGE_KEY, bytes); storage.writes = [];
    assert.equal(loadLocal(() => storage).protected, true);
    assert.equal(saveLocal({ ...result(), remember: true }, () => storage, bytes).ok, false);
    assert.equal(clearLocal(() => storage, bytes).ok, false);
    assert.equal(storage.getItem(STORAGE_KEY), bytes); assert.deepEqual(storage.writes, []);
  }
});
test('stale write and stale clear refuse to overwrite a different tab snapshot', () => {
  const storage = new MemoryStorage(); const s = { ...result(), remember: true };
  const first = saveLocal(s, () => storage, null);
  const second = saveLocal({ ...s, note: 'Other tab' }, () => storage, first.raw);
  assert.equal(second.ok, true);
  assert.equal(saveLocal({ ...s, note: 'Stale tab' }, () => storage, first.raw).conflict, true);
  assert.equal(clearLocal(() => storage, first.raw).conflict, true);
  assert.equal(storage.getItem(STORAGE_KEY), second.raw);
});
test('quota and blocked reads cannot falsely report saved', () => {
  const storage = new MemoryStorage(); storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(saveLocal({ ...result(), remember: true }, () => storage, null).ok, false);
  assert.equal(loadLocal(() => { throw new Error('Denied'); }).ok, false);
});
test('new modules remain local and rendering never interprets supplied HTML', async () => {
  for (const file of ['app', 'output', 'storage']) {
    const code = await readFile(new URL(`../src/${file}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  }
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /src\/output\.js/); assert.match(sw, /2\.0\.0/);
});
