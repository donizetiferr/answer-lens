import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptySession, beginBlind, setRating, lockAndReveal, nextPair, exportResult, importResult, migrateV1, validateSession } from '../src/core.js';
import { demoSession } from '../src/demo.js';
import { decisionNote, preferredAnswer, ratingText } from '../src/output.js';
import { STORAGE_KEY, LEGACY_KEY, saveLocal, clearLocal, loadLocal, loadLegacy } from '../src/storage.js';
import * as v1 from './fixtures/v1/core.js';
import * as v1Storage from './fixtures/v1/storage.js';
import { appFixture, controlledLocks, settleApp } from './fixtures/app.mjs';
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
test('an older clipboard failure cannot replace the feedback for a later successful copy', async () => {
  let rejectFirst;
  const copied = [];
  const clipboard = { writeText(text) {
    copied.push(text);
    return copied.length === 1 ? new Promise((_resolve, reject) => { rejectFirst = reject; }) : Promise.resolve();
  } };
  const app = await appFixture({ initial: JSON.stringify({ ...result(), remember: true }), clipboard });
  const first = app.get('#copy-note').click();
  await app.get('#copy-answer').click();
  assert.equal(copied[0], decisionNote(result()));
  assert.equal(copied[1], preferredAnswer(result()));
  assert.match(app.get('#status').textContent, /Preferred answer copied/);
  rejectFirst(new Error('Delayed permission denial')); await first;
  assert.equal(app.get('#copy-fallback').hidden, true);
  assert.match(app.get('#status').textContent, /Preferred answer copied/);
});
test('a successful answer copy clears an older decision-note fallback', async () => {
  const clipboard = { async writeText() { throw new Error('Permission denied'); } };
  const app = await appFixture({ initial: JSON.stringify({ ...result(), remember: true }), clipboard });
  await app.get('#copy-note').click();
  assert.equal(app.get('#copy-fallback').hidden, false);
  assert.equal(app.get('#copy-text').value, decisionNote(result()));
  clipboard.writeText = async () => {};
  await app.get('#copy-answer').click();
  assert.equal(app.get('#copy-fallback').hidden, true);
  assert.equal(app.get('#copy-text').value, '');
  assert.match(app.get('#status').textContent, /Preferred answer copied/);
});
test('a late copy success preserves the newer answer fallback and its selection', async () => {
  let finishFirst, calls = 0;
  const clipboard = { writeText() {
    if (++calls === 1) return new Promise(resolve => { finishFirst = resolve; });
    return Promise.reject(new Error('The newer copy was denied'));
  } };
  const app = await appFixture({ initial: JSON.stringify({ ...result(), remember: true }), clipboard });
  const first = app.get('#copy-note').click();
  await app.get('#copy-answer').click();
  const status = app.get('#status').textContent;
  assert.equal(app.get('#copy-text').value, preferredAnswer(result()));
  finishFirst(); await first;
  assert.equal(app.get('#copy-fallback').hidden, false);
  assert.equal(app.get('#copy-text').value, preferredAnswer(result()));
  assert.equal(app.document.activeElement, app.get('#copy-text'));
  assert.equal(app.get('#copy-text').selectionEnd, preferredAnswer(result()).length);
  assert.equal(app.get('#status').textContent, status);
});
test('copy completion after reset never opens fallback or rewrites the new view status', async () => {
  for (const rejected of [false, true]) {
    let finish;
    const clipboard = { writeText: () => new Promise((resolve, reject) => {
      finish = () => rejected ? reject(new Error('Late denial')) : resolve();
    }) };
    const app = await appFixture({ initial: JSON.stringify({ ...result(), remember: true }), clipboard });
    const copying = app.get('#copy-note').click();
    await app.get('#reset-button').click(); await app.get('#confirm-reset').click(); await settleApp();
    const status = app.get('#status').textContent;
    finish(); await copying;
    assert.equal(app.get('#copy-fallback'), null);
    assert.equal(app.get('#question').value, '');
    assert.equal(app.get('#status').textContent, status);
    assert.equal(app.get('#error').hidden, true);
  }
});
test('opaque preview export keeps the full JSON selected when an older copy finishes', async () => {
  for (const lateFailure of [false, true]) {
    let finish;
    const clipboard = { writeText: () => new Promise((resolve, reject) => {
      finish = () => lateFailure ? reject(new Error('A delayed copy denial.')) : resolve();
    }) };
    const app = await appFixture({ preview: true, opaque: true, clipboard });
    const json = exportResult(result());
    await app.chooseFile({ name: 'result.json', size: json.length, text: async () => json }); await settleApp();
    const copying = app.get('#copy-note').click();
    await app.get('#export-button').click();
    const message = app.get('#status').textContent;
    assert.match(message, /full result JSON is selected/);
    assert.equal(app.get('#copy-text').value, json);
    finish(); await copying;
    assert.equal(app.get('#copy-fallback').hidden, false);
    assert.equal(app.get('#copy-label').textContent, 'Full result JSON — select and copy');
    assert.equal(app.get('#copy-text').value, json);
    assert.equal(app.get('#copy-text').selectionEnd, json.length);
    assert.equal(app.get('#status').textContent, message);
    assert.equal(app.data.size, 0);
  }
});
test('next pair retains exactly the question, not consent, answers, source names or demo status', () => {
  const s = result(); s.remember = true;
  const next = nextPair(s);
  assert.deepEqual(next, { ...emptySession(), question: s.question });
  assert.equal(s.phase, 'revealed'); assert.equal(s.remember, true);
});
test('cancelling a valid import lets the same file be selected again without losing the draft', async () => {
  const app = await appFixture();
  await app.input('#question', 'Keep this draft unless I confirm.');
  const json = exportResult(result());
  const file = { name: 'result.json', size: Buffer.byteLength(json), text: async () => json };
  assert.equal(await app.chooseFile(file), true);
  assert.equal(app.get('#reset-dialog').open, true);
  await app.get('#cancel-reset').click();
  assert.equal(app.get('#question').value, 'Keep this draft unless I confirm.');
  assert.equal(await app.chooseFile(file), true, 'The same valid result must be selectable after cancelling.');
  assert.equal(app.get('#reset-dialog').open, true);
  assert.equal(app.data.size, 0, 'Opening or cancelling must not silently opt into saving.');
});
test('invalid and oversized files can be retried and do not replace the current draft', async () => {
  const app = await appFixture(); await app.input('#question', 'Current draft');
  let reads = 0;
  for (const file of [
    { name: 'invalid.json', size: 1, text: async () => '{' },
    { name: 'huge.json', size: 600001, text: async () => { reads++; return ''; } }
  ]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal(await app.chooseFile(file), true);
      assert.equal(app.get('#error').hidden, false);
      assert.equal(app.get('#question').value, 'Current draft');
      assert.equal(app.get('#reset-dialog').open, false);
    }
  }
  assert.equal(reads, 0, 'An oversized file must be rejected before reading.');
});
test('a file read completed after the view changes cannot replace the new comparison', async () => {
  const app = await appFixture(); let finish;
  const json = exportResult(result());
  const reading = app.chooseFile({ name: 'slow.json', size: json.length, text: () => new Promise(resolve => { finish = resolve; }) });
  await app.get('#demo-button').click();
  const question = app.get('#question').value;
  finish(json); await reading;
  assert.equal(app.get('#question').value, question);
  assert.equal(app.get('#reset-dialog').open, false);
  assert.equal(app.get('#export-button'), null);
});
test('a delayed import cannot change a reset confirmation or its confirmed action', async () => {
  const app = await appFixture();
  await app.input('#question', 'Reset this draft only when I confirm.');
  const json = exportResult(result());
  let finish;
  const reading = app.chooseFile({ name: 'slow.json', size: json.length, text: () => new Promise(resolve => { finish = resolve; }) });
  await app.get('#reset-button').click();
  const heading = app.get('#reset-heading').textContent;
  finish(json); await reading;
  assert.equal(app.get('#reset-dialog').open, true);
  assert.equal(app.get('#reset-heading').textContent, heading);
  assert.equal(app.get('#error').hidden, true);
  await app.get('#confirm-reset').click(); await settleApp();
  assert.equal(app.get('#question').value, '');
  assert.equal(app.get('#export-button'), null, 'Confirming Reset must never open the delayed import.');
  assert.equal(app.data.has(STORAGE_KEY), false);
});
test('a superseded file read cannot surface an error during or after a cancelled confirmation', async () => {
  for (const cancelBeforeRead of [false, true]) {
    const app = await appFixture();
    await app.input('#question', 'Keep this draft when Reset is cancelled.');
    let rejectRead;
    const reading = app.chooseFile({ name: 'slow.json', size: 100, text: () => new Promise((_resolve, reject) => { rejectRead = reject; }) });
    await app.get('#reset-button').click();
    if (cancelBeforeRead) await app.get('#cancel-reset').click();
    rejectRead(new Error('An obsolete read error.')); await reading;
    assert.equal(app.get('#error').hidden, true);
    assert.equal(app.get('#reset-dialog').open, !cancelBeforeRead);
    assert.equal(app.get('#question').value, 'Keep this draft when Reset is cancelled.');
  }
});
test('only the most recently selected file can open a result or report a read error', async () => {
  for (const lateFailure of [false, true]) {
    const app = await appFixture();
    let resolveOld, rejectOld;
    const oldRead = new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject; });
    const first = app.chooseFile({ name: 'old.json', size: 100, text: () => oldRead });
    const latest = { ...result(), note: 'Only the latest selected result belongs in this tab.' };
    await app.chooseFile({ name: 'latest.json', size: 100, text: async () => exportResult(latest) });
    await settleApp();
    assert.ok(app.get('#export-button'));
    if (lateFailure) rejectOld(new Error('The old file is no longer readable.'));
    else resolveOld(exportResult(result()));
    await first; await settleApp();
    assert.equal(app.get('#error').hidden, true);
    assert.equal(app.get('#reset-dialog').open, false);
    assert.equal(app.get('#remember').checked, false);
    assert.equal(app.data.has(STORAGE_KEY), false);
    await app.get('#copy-note').click();
    assert.equal(app.get('#copy-text').value, decisionNote(latest));
  }
});
test('a pending import followed by an invalid newer file cannot reopen the superseded result', async () => {
  for (const lateFailure of [false, true]) {
    const app = await appFixture();
    await app.input('#question', 'My draft must survive both file attempts.');
    let resolveOld, rejectOld;
    const first = app.chooseFile({ name: 'old.json', size: 100, text: () => new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject; }) });
    await app.chooseFile({ name: 'invalid.json', size: 2, text: async () => '{}' });
    const message = app.get('#error').textContent;
    assert.match(message, /not an Answer Lens result/);
    if (lateFailure) rejectOld(new Error('An obsolete read failure must not replace the newer error.'));
    else resolveOld(exportResult(result()));
    await first; await settleApp();
    assert.equal(app.get('#error').hidden, false);
    assert.equal(app.get('#error').textContent, message);
    assert.equal(app.get('#question').value, 'My draft must survive both file attempts.');
    assert.equal(app.get('#reset-dialog').open, false);
    assert.equal(app.get('#import-file').value, '');
    assert.equal(app.data.has(STORAGE_KEY), false);
  }
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
test('the app resumes real v1 drafts and blind decisions without adopting their old saving consent', async () => {
  for (const phase of ['setup', 'blind']) {
    let old = { ...demoSession(true), version: 1 };
    if (phase === 'blind') {
      old = v1.beginBlind(old, { seed: 1, now: start });
      old = v1.setRating(old, 'B', 'clarity', 3);
      old.verdict = 'B'; old.note = 'A decision started in the old application.';
    }
    const legacy = JSON.stringify(old);
    const app = await appFixture({ legacy });
    assert.equal(app.get('#question').value, '', 'Legacy content requires the explicit open action.');
    await app.get('#legacy-button').click(); await settleApp();
    assert.equal(app.get('#remember').checked, false);
    assert.equal(app.data.has(STORAGE_KEY), false);
    assert.equal(app.data.get(LEGACY_KEY), legacy);
    if (phase === 'setup') {
      assert.equal(app.get('#question').value, old.question);
      assert.equal(app.get('#answer-0').value, old.inputs[0].text);
      assert.equal(app.get('#origin-1').value, old.inputs[1].origin);
      await app.get('#setup-form').fire('submit');
      await app.get('input[name="verdict"]').fire('change');
    } else {
      const verdicts = app.document.querySelectorAll('input[name="verdict"]');
      assert.equal(verdicts.find(node => node.value === 'B').checked, true);
      assert.equal(app.get('#note').value, old.note);
      assert.equal(app.document.querySelectorAll('input[name="B-clarity"]').find(node => node.value === '3').checked, true);
    }
    assert.equal(app.get('#origin-0'), null);
    assert.equal(app.get('#export-button'), null);
    await app.get('#verdict-form').fire('submit'); await settleApp();
    assert.ok(app.get('#export-button'));
    assert.equal(app.data.has(STORAGE_KEY), false);
    app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp();
    const saved = loadLocal(() => app.localStorage).session;
    assert.equal(saved.version, 2); assert.equal(saved.phase, 'revealed');
    assert.deepEqual(saved.inputs, old.inputs);
    assert.equal(saved.verdict, phase === 'blind' ? 'B' : 'A');
    if (phase === 'blind') {
      assert.deepEqual(saved.randomization, old.randomization);
      assert.deepEqual(saved.ratings, old.ratings);
      assert.equal(saved.note, old.note);
    }
    await app.get('#reset-button').click(); await app.get('#confirm-reset').click(); await settleApp();
    assert.equal(app.data.has(STORAGE_KEY), false);
    assert.equal(app.data.get(LEGACY_KEY), legacy);
  }
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
test('re-enabling saving during deletion stays visibly pending until the new write finishes', async () => {
  const locks = controlledLocks();
  const app = await appFixture({ locks });
  const enable = async () => { app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp(); };
  try {
    await app.input('#question', 'Draft retained through a quick saving toggle.');
    await enable(); await locks.release();
    assert.equal(app.get('#data-status').dataset.state, 'saved');
    app.get('#remember').checked = false;
    const clearing = app.get('#remember').fire('change'); await settleApp();
    assert.equal(app.get('#data-status').dataset.state, 'clearing');
    await enable();
    await locks.release(); await clearing;
    assert.equal(app.data.get(STORAGE_KEY), undefined);
    assert.equal(locks.pending.length, 1, 'The replacement save is still waiting for its lock.');
    assert.equal(app.get('#remember').checked, true);
    assert.equal(app.get('#data-status').dataset.state, 'saving');
    assert.match(app.get('#save-feedback').textContent, /Saving/);
    await locks.release();
    assert.equal(app.get('#data-status').dataset.state, 'saved');
    assert.equal(JSON.parse(app.data.get(STORAGE_KEY)).question, 'Draft retained through a quick saving toggle.');
  } finally { await locks.drain(); }
});
test('queued keystrokes never save obsolete snapshots and the latest edit gets its own save receipt', async () => {
  const locks = controlledLocks(); const app = await appFixture({ locks });
  try {
    await app.input('#question', 'Original draft');
    app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp();
    await app.input('#question', 'Superseded edit');
    await app.input('#question', 'Latest edit');
    assert.equal(app.get('#data-status').dataset.state, 'saving');
    await locks.release();
    assert.equal(app.data.size, 0, 'The obsolete snapshot must not be written after waiting for its lock.');
    assert.equal(locks.pending.length, 1);
    assert.equal(app.get('#data-status').dataset.state, 'saving');
    await locks.release();
    assert.equal(app.get('#data-status').dataset.state, 'saved');
    assert.equal(JSON.parse(app.data.get(STORAGE_KEY)).question, 'Latest edit');
  } finally { await locks.drain(); }
});
test('reset cancels a queued save and preserves the new unsaved draft typed during cleanup', async () => {
  const locks = controlledLocks(); const app = await appFixture({ locks });
  try {
    await app.input('#question', 'Old answers must not return.');
    app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp();
    await app.get('#reset-button').click(); await app.get('#confirm-reset').click();
    await app.input('#question', 'Fresh draft typed while waiting.');
    await locks.drain();
    assert.equal(app.data.size, 0);
    assert.equal(app.get('#question').value, 'Fresh draft typed while waiting.');
    assert.equal(app.get('#remember').checked, false);
    assert.equal(app.get('#data-status').dataset.state, 'tab');
  } finally { await locks.drain(); }
});
test('the app restores its actual saved draft from the injected device storage', async () => {
  const saved = { ...demoSession(true), question: 'A saved draft from this device.' };
  const raw = JSON.stringify(saved);
  const app = await appFixture({ initial: raw });
  assert.equal(app.get('#question').value, saved.question);
  assert.equal(app.get('#remember').checked, true);
  assert.equal(app.get('#data-status').dataset.state, 'saved');
  assert.equal(app.data.get(STORAGE_KEY), raw);
  // A redundant event must be compared with the same injected snapshot.
  await app.window.fire('storage', { key: STORAGE_KEY, storageArea: app.localStorage });
  assert.equal(app.get('#data-status').dataset.state, 'saved');
  await app.input('#question', 'An edit to the restored draft.'); await settleApp();
  assert.equal(app.get('#data-status').dataset.state, 'saved');
  assert.equal(JSON.parse(app.data.get(STORAGE_KEY)).question, 'An edit to the restored draft.');
});
test('the app protects unsupported initial records and opens legacy data only on request', async () => {
  const raw = '{"version":99,"question":"Preserve this future record."}';
  const app = await appFixture({ initial: raw });
  assert.equal(app.get('#data-status').dataset.state, 'protected');
  assert.equal(app.get('#remember').disabled, true);
  assert.equal(app.get('#question').value, '');
  assert.equal(app.data.get(STORAGE_KEY), raw);
  const legacy = JSON.stringify({ ...legacyResult(), remember: true });
  const older = await appFixture({ legacy });
  assert.equal(older.get('#question').value, '');
  assert.equal(older.get('#data-status').dataset.state, 'tab');
  await older.get('#legacy-button').click(); await settleApp();
  assert.ok(older.get('#export-button'));
  assert.equal(older.get('#remember').checked, false);
  assert.equal(older.data.get(LEGACY_KEY), legacy);
  assert.equal(older.data.has(STORAGE_KEY), false);
});
test('reset and import without a saved copy do not require browser lock support', async () => {
  const app = await appFixture({ locks: null });
  await app.input('#question', 'A tab-only draft.');
  await app.get('#reset-button').click(); await app.get('#confirm-reset').click(); await settleApp();
  assert.equal(app.get('#question').value, '');
  assert.equal(app.get('#data-status').dataset.state, 'tab');
  const json = exportResult(result());
  await app.chooseFile({ name: 'result.json', size: json.length, text: async () => json }); await settleApp();
  assert.ok(app.get('#export-button'));
  assert.equal(app.get('#remember').checked, false);
  assert.equal(app.get('#data-status').dataset.state, 'tab');
  assert.equal(app.data.has(STORAGE_KEY), false);
});
test('missing lock support still protects an existing saved comparison during reset', async () => {
  const raw = JSON.stringify(demoSession(true));
  const app = await appFixture({ initial: raw, locks: null });
  await app.get('#reset-button').click(); await app.get('#confirm-reset').click(); await settleApp();
  assert.equal(app.get('#question').value, '');
  assert.equal(app.get('#remember').checked, false);
  assert.equal(app.get('#data-status').dataset.state, 'delete-failed');
  assert.equal(app.data.get(STORAGE_KEY), raw);
});
test('an external save cancels this queued write and reset leaves the other tab record untouched', async () => {
  const locks = controlledLocks(); const app = await appFixture({ locks });
  try {
    await app.input('#question', 'My independent draft.');
    app.get('#question').focus();
    app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp();
    const other = JSON.stringify({ ...demoSession(true), question: 'Other tab owns this saved record.' });
    app.data.set(STORAGE_KEY, other);
    await app.window.fire('storage', { key: STORAGE_KEY, storageArea: app.localStorage });
    assert.equal(app.get('#data-status').dataset.state, 'conflict');
    assert.equal(app.get('#remember').checked, false);
    assert.equal(app.document.activeElement, app.get('#question'));
    assert.equal(app.get('#question').value, 'My independent draft.');
    await locks.release();
    assert.equal(app.data.get(STORAGE_KEY), other);
    await app.get('#reset-button').click(); await app.get('#confirm-reset').click(); await settleApp();
    assert.equal(app.data.get(STORAGE_KEY), other);
    assert.equal(app.get('#question').value, '');
    assert.equal(locks.pending.length, 0, 'Reset must not request a deletion for another tab record.');
  } finally { await locks.drain(); }
});
test('a stale replacement confirmation preserves the latest other-tab record and a fresh confirmation can save', async () => {
  const app = await appFixture();
  await app.input('#question', 'Keep my independent draft.');
  const other = note => JSON.stringify({ ...result(), remember: true, note });
  const receive = async raw => {
    app.data.set(STORAGE_KEY, raw);
    await app.window.fire('storage', { key: STORAGE_KEY, storageArea: app.localStorage });
  };
  const enable = async () => { app.get('#remember').checked = true; await app.get('#remember').fire('change'); };
  await receive(other('First external snapshot.'));
  await enable();
  assert.equal(app.get('#reset-dialog').open, true);
  const latest = other('Updated while the confirmation was open.');
  await receive(latest);
  await app.get('#confirm-reset').click(); await settleApp();
  assert.equal(app.data.get(STORAGE_KEY), latest);
  assert.equal(app.get('#data-status').dataset.state, 'conflict');
  assert.equal(app.get('#remember').checked, false);
  assert.equal(app.get('#question').value, 'Keep my independent draft.');
  await enable();
  assert.equal(app.get('#reset-dialog').open, true);
  await app.get('#confirm-reset').click(); await settleApp();
  assert.equal(app.get('#data-status').dataset.state, 'saved');
  assert.equal(app.get('#remember').checked, true);
  assert.equal(JSON.parse(app.data.get(STORAGE_KEY)).question, 'Keep my independent draft.');
});
test('future other-tab records disable saving and remain protected until that record changes', async () => {
  const app = await appFixture({ initial: JSON.stringify(demoSession(true)) });
  const future = '{"version":99,"private":"Synthetic future record."}';
  app.data.set(STORAGE_KEY, future);
  await app.window.fire('storage', { key: null, storageArea: app.localStorage });
  assert.equal(app.get('#data-status').dataset.state, 'protected');
  assert.equal(app.get('#remember').checked, false);
  assert.equal(app.get('#remember').disabled, true);
  await app.input('#question', 'My draft stays editable while device data is protected.');
  assert.equal(app.data.get(STORAGE_KEY), future);
  app.data.delete(STORAGE_KEY);
  await app.window.fire('storage', { key: STORAGE_KEY, storageArea: app.localStorage });
  assert.equal(app.get('#data-status').dataset.state, 'conflict');
  assert.equal(app.get('#remember').disabled, false);
  assert.equal(app.get('#question').value, 'My draft stays editable while device data is protected.');
  app.get('#remember').checked = true; await app.get('#remember').fire('change');
  assert.equal(app.get('#reset-dialog').open, true);
  await app.get('#cancel-reset').click();
  assert.equal(app.data.has(STORAGE_KEY), false);
  assert.equal(app.get('#remember').checked, false);
});
test('restoring the original snapshot after a protected record unlocks the saving choice without replacing this draft', async () => {
  for (const initial of [null, JSON.stringify(demoSession(true))]) {
    const app = await appFixture({ initial });
    await app.input('#question', 'Keep my current draft and focus.'); await settleApp();
    // Use the last successfully observed snapshot, including a saved edit.
    const original = app.data.get(STORAGE_KEY) ?? null;
    const question = app.get('#question'); question.focus();
    app.data.set(STORAGE_KEY, '{"version":99,"question":"Synthetic future format."}');
    await app.window.fire('storage', { key: STORAGE_KEY, storageArea: app.localStorage });
    assert.equal(app.get('#remember').disabled, true);
    assert.equal(app.get('#data-status').dataset.state, 'protected');
    if (original === null) app.data.delete(STORAGE_KEY);
    else app.data.set(STORAGE_KEY, original);
    await app.window.fire('storage', { key: original === null ? null : STORAGE_KEY, storageArea: app.localStorage });
    assert.equal(app.get('#remember').disabled, false, 'A supported or absent record must no longer be protected.');
    assert.equal(app.get('#remember').checked, false, 'Recovery never silently re-enables saving.');
    assert.equal(app.get('#data-status').dataset.state, 'conflict');
    assert.equal(app.get('#question'), question);
    assert.equal(question.value, 'Keep my current draft and focus.');
    assert.equal(app.document.activeElement, question);
    await app.input('#question', 'An explicit replacement can save this edit.');
    app.get('#remember').checked = true; await app.get('#remember').fire('change');
    assert.equal(app.get('#reset-dialog').open, true);
    assert.equal(app.data.get(STORAGE_KEY) ?? null, original);
    await app.get('#confirm-reset').click(); await settleApp();
    assert.equal(app.get('#data-status').dataset.state, 'saved');
    assert.equal(JSON.parse(app.data.get(STORAGE_KEY)).question, 'An explicit replacement can save this edit.');
  }
});
test('a rejected save stays unsaved and retry saves the current draft before removing the leave warning', async () => {
  const locks = { async request() { throw new Error('Lock service temporarily failed.'); } };
  const app = await appFixture({ locks });
  await app.input('#question', 'Keep this draft through the failure.');
  app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp();
  assert.equal(app.get('#data-status').dataset.state, 'failed');
  assert.equal(app.get('#save-retry').hidden, false);
  assert.equal(app.data.size, 0);
  let warned = false;
  await app.window.fire('beforeunload', { preventDefault() { warned = true; } });
  assert.equal(warned, true);
  locks.request = async (_name, action) => action();
  await app.get('#save-retry').click(); await settleApp();
  assert.equal(app.get('#data-status').dataset.state, 'saved');
  assert.equal(JSON.parse(app.data.get(STORAGE_KEY)).question, 'Keep this draft through the failure.');
  warned = false;
  await app.window.fire('beforeunload', { preventDefault() { warned = true; } });
  assert.equal(warned, false);
});
test('clearing optional ratings keeps the selected verdict and reason in both app handlers', async () => {
  for (const preview of [false, true]) {
    const app = await appFixture({ preview, initial: JSON.stringify({ ...blind(), remember: true }) });
    const key = preview ? 'answer-lens.preview.session.v2' : STORAGE_KEY;
    await app.get('#verdict-form').fire('submit');
    assert.equal(app.get('#verdict-error').hidden, false);
    assert.equal(app.document.activeElement, app.get('input[name="verdict"]'));
    const verdict = app.document.querySelectorAll('input[name="verdict"]').find(node => node.value === 'B');
    verdict.checked = true; await verdict.fire('change');
    assert.equal(app.get('#verdict-error').hidden, true);
    await app.input('#note', 'The reason remains even when optional scores are removed.');
    for (const [group, value] of [['A-clarity', '4'], ['B-factualConfidence', 'unsure']]) {
      const rating = app.document.querySelectorAll(`input[name="${group}"]`).find(node => node.value === value);
      rating.checked = true; await rating.fire('change');
    }
    await settleApp();
    assert.deepEqual(JSON.parse(app.data.get(key)).ratings, { A: { clarity: 4 }, B: { factualConfidence: 'unsure' } });
    await app.get('#clear-ratings').click(); await settleApp();
    assert.ok(app.document.querySelectorAll('#details-ratings input[type=radio]').every(node => !node.checked));
    assert.equal(verdict.checked, true);
    assert.equal(app.get('#note').value, 'The reason remains even when optional scores are removed.');
    await app.get('#verdict-form').fire('submit'); await settleApp();
    const saved = JSON.parse(app.data.get(key));
    assert.equal(saved.phase, 'revealed'); assert.equal(saved.verdict, 'B');
    assert.equal(saved.note, 'The reason remains even when optional scores are removed.');
    assert.deepEqual(saved.ratings, { A: {}, B: {} });
    assert.equal(app.get('#data-status').dataset.state, 'saved');
  }
});
test('quota failure remains visible through blind and reveal, and retry saves the complete result', async () => {
  for (const preview of [false, true]) {
    const initial = JSON.stringify(demoSession(true));
    const app = await appFixture({ preview, initial });
    const key = preview ? 'answer-lens.preview.session.v2' : STORAGE_KEY;
    const setItem = app.localStorage.setItem;
    app.localStorage.setItem = () => { throw new Error('Synthetic quota exhaustion.'); };
    await app.get('#setup-form').fire('submit'); await settleApp();
    assert.equal(app.get('#data-status').dataset.state, 'failed');
    assert.equal(app.get('#save-retry').hidden, false);
    await app.get('input[name="verdict"]').fire('change');
    await app.input('#note', 'The failed saved copy must not erase this locked reason.');
    await app.get('#verdict-form').fire('submit'); await settleApp();
    assert.ok(app.get('#export-button'));
    assert.equal(app.get('#data-status').dataset.state, 'failed');
    assert.match(app.get('#save-feedback').textContent, /Not saved/);
    assert.equal(app.data.get(key), initial);
    app.localStorage.setItem = setItem;
    await app.get('#save-retry').click(); await settleApp();
    assert.equal(app.get('#data-status').dataset.state, 'saved');
    const saved = JSON.parse(app.data.get(key));
    assert.equal(saved.phase, 'revealed'); assert.equal(saved.verdict, 'A');
    assert.equal(saved.note, 'The failed saved copy must not erase this locked reason.');
    assert.equal(saved.remember, true);
  }
});
test('failed deletion preserves the saved bytes and its warning until a new explicit saving choice', async () => {
  for (const preview of [false, true]) {
    const initial = JSON.stringify(demoSession(true));
    const app = await appFixture({ preview, initial });
    const key = preview ? 'answer-lens.preview.session.v2' : STORAGE_KEY;
    app.localStorage.removeItem = () => { throw new Error('Synthetic deletion denial.'); };
    await app.get('#reset-button').click(); await app.get('#confirm-reset').click(); await settleApp();
    assert.equal(app.get('#question').value, '');
    assert.equal(app.get('#remember').checked, false);
    assert.equal(app.get('#data-status').dataset.state, 'delete-failed');
    assert.equal(app.data.get(key), initial);
    await app.input('#question', 'My new draft remains independent of the undeleted copy.');
    assert.equal(app.get('#data-status').dataset.state, 'delete-failed');
    assert.equal(app.data.get(key), initial);
    app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp();
    assert.equal(app.get('#data-status').dataset.state, 'saved');
    assert.equal(JSON.parse(app.data.get(key)).question, 'My new draft remains independent of the undeleted copy.');
  }
});
test('preview app handlers keep root records and ignore root-tab storage events', async () => {
  const app = await appFixture({ preview: true });
  const root = JSON.stringify({ ...result(), remember: true });
  app.data.set(STORAGE_KEY, root);
  app.data.set(LEGACY_KEY, 'Preserve the root legacy key.');
  await app.input('#question', 'Preview draft only.'); app.get('#question').focus();
  app.get('#remember').checked = true; await app.get('#remember').fire('change'); await settleApp();
  assert.equal(app.get('#data-status').dataset.state, 'saved');
  await app.window.fire('storage', { key: STORAGE_KEY, storageArea: app.localStorage });
  assert.equal(app.get('#data-status').dataset.state, 'saved');
  assert.equal(app.get('#remember').checked, true);
  assert.equal(app.document.activeElement, app.get('#question'));
  await app.get('#reset-button').click(); await app.get('#confirm-reset').click(); await settleApp();
  assert.deepEqual([...app.data], [[STORAGE_KEY, root], [LEGACY_KEY, 'Preserve the root legacy key.']]);
  assert.equal(app.get('#question').value, '');
  assert.equal(app.get('#data-status').dataset.state, 'tab');
});
test('new modules remain local and rendering never interprets supplied HTML', async () => {
  for (const file of ['app', 'output', 'storage']) {
    const code = await readFile(new URL(`../src/${file}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  }
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /src\/output\.js/); assert.match(sw, /2\.0\.0/);
});
