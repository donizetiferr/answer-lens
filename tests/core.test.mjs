import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptySession, beginBlind, orderingFromSeed, comparisonView, setRating, ratingsComplete, lockAndReveal, exportResult, importResult, validateSession, LIMITS, CAVEATS } from '../src/core.js';
import { demoSession } from '../src/demo.js';
const time = '2026-09-21T04:00:00.000Z';
const later = '2026-09-21T04:01:00.000Z';
const blind = (seed = 0) => beginBlind(demoSession(), { seed, now: time });
function rated() {
  let session = blind();
  for (const label of ['A', 'B']) for (const metric of ['usefulness', 'clarity', 'factualConfidence']) session = setRating(session, label, metric, metric === 'factualConfidence' ? 'unsure' : 4);
  return session;
}
const result = () => lockAndReveal(rated(), 'tie', 'A human opinion, not a fact check.', later);

test('deterministic seeded ordering has independent fixed vectors', () => {
  assert.deepEqual(orderingFromSeed(0), [0, 1]);
  assert.deepEqual(orderingFromSeed(1), [1, 0]);
  assert.deepEqual(orderingFromSeed(42), [1, 0]);
  for (let seed = 0; seed < 100; seed++) assert.deepEqual(orderingFromSeed(seed), orderingFromSeed(seed));
});
test('ordering rejects absent, negative, fractional and oversized seeds', () => {
  for (const seed of [undefined, -1, 1.5, NaN, Infinity, 2 ** 32, '4']) assert.throws(() => orderingFromSeed(seed));
  assert.equal(orderingFromSeed(0xffffffff).length, 2);
});
test('recorded shuffle preserves answers and applies A/B mapping', () => {
  const original = demoSession(); const session = beginBlind(original, { seed: 1, now: time });
  assert.equal(original.phase, 'setup');
  assert.deepEqual(session.randomization.order, [1, 0]);
  assert.equal(session.randomization.seed, 1); assert.equal(session.randomization.assignedAt, time);
  assert.equal(comparisonView(session).answers[0].text, original.inputs[1].text);
});
test('blind view contains no origins, indexes, seed or randomization metadata', () => {
  const session = blind(); const view = comparisonView(session); const json = JSON.stringify(view);
  for (const input of session.inputs) assert.ok(!json.includes(input.origin));
  for (const key of ['origin', 'seed', 'order', 'randomization', 'inputIndex']) assert.ok(!json.includes(`"${key}"`));
  assert.deepEqual(view.answers.map(answer => answer.label), ['A', 'B']);
});
test('draft is not exposed as a blind view', () => assert.throws(() => comparisonView(demoSession())));
test('validation requires a question and both nonblank answers', () => {
  for (const kind of ['question', 'answer0', 'answer1']) {
    const session = demoSession();
    if (kind === 'question') session.question = '  \n'; else session.inputs[Number(kind.at(-1))].text = '\t ';
    assert.throws(() => beginBlind(session, { seed: 0, now: time }), /required/);
  }
});
test('input lengths and types are validated', () => {
  for (const [field, max] of [['question', LIMITS.question], ['text', LIMITS.answer], ['origin', LIMITS.origin]]) {
    const session = demoSession();
    if (field === 'question') session.question = 'x'.repeat(max + 1); else session.inputs[0][field] = 'x'.repeat(max + 1);
    assert.throws(() => beginBlind(session, { seed: 0, now: time }), /too long/);
  }
  const session = demoSession(); session.inputs[1].text = 42;
  assert.throws(() => beginBlind(session, { seed: 0, now: time }), /text/);
});
test('empty source names are allowed and only get a fallback after reveal', () => {
  let session = rated(); session.inputs.forEach(input => { input.origin = ''; });
  assert.ok(!('origin' in comparisonView(session).answers[0]));
  session = lockAndReveal(session, 'neither', '', later);
  assert.equal(comparisonView(session).answers[0].origin, 'Source not specified');
});
test('starting twice cannot reshuffle or reset ratings secretly', () => assert.throws(() => beginBlind(blind(), { seed: 1, now: time }), /Reset/));
test('ratings are explicit 1–5 values, with unsure only for factual confidence', () => {
  for (const value of [0, 6, 2.5, '5', null, NaN, 'unsure']) assert.throws(() => setRating(blind(), 'A', 'usefulness', value));
  assert.throws(() => setRating(blind(), 'C', 'clarity', 3));
  assert.throws(() => setRating(blind(), 'A', 'accuracy', 3));
  assert.equal(setRating(blind(), 'A', 'factualConfidence', 'unsure').ratings.A.factualConfidence, 'unsure');
});
test('ratings update immutably and a complete pair requires six judgments', () => {
  const initial = blind(); const next = setRating(initial, 'A', 'clarity', 4);
  assert.deepEqual(initial.ratings.A, {}); assert.equal(next.ratings.A.clarity, 4);
  assert.equal(ratingsComplete(next), false); assert.equal(ratingsComplete(rated()), true);
});
test('reveal requires a specific verdict, not optional ratings', () => {
  assert.equal(lockAndReveal(blind(), 'A', '', later).phase, 'revealed');
  assert.throws(() => lockAndReveal(blind(), null, '', later), /verdict/);
  for (const verdict of [null, undefined, '', 'best model']) assert.throws(() => lockAndReveal(rated(), verdict, '', later), /verdict/);
});
test('all four verdicts are supported and origins appear only after lock', () => {
  for (const verdict of ['A', 'B', 'tie', 'neither']) {
    const session = lockAndReveal(rated(), verdict, '', later);
    assert.equal(session.phase, 'revealed'); assert.equal(session.lockedAt, later);
    assert.equal(comparisonView(session).answers[0].origin, session.inputs[0].origin);
  }
});
test('a revealed verdict cannot be rerated or revealed again', () => {
  assert.throws(() => setRating(result(), 'A', 'clarity', 1));
  assert.throws(() => lockAndReveal(result(), 'B', '', later));
});
test('timestamps and note lengths are checked', () => {
  assert.throws(() => beginBlind(demoSession(), { seed: 0, now: 'not a date' }));
  assert.throws(() => lockAndReveal(rated(), 'A', '', '2025-01-01T00:00:00.000Z'));
  assert.throws(() => lockAndReveal(rated(), 'A', 'x'.repeat(LIMITS.note + 1), later));
});
test('export is impossible during setup or blind comparison', () => {
  assert.throws(() => exportResult(demoSession())); assert.throws(() => exportResult(rated()));
});
test('self-contained JSON roundtrip preserves full answers, ratings, mapping and verdict', () => {
  const session = result(); session.remember = true;
  const json = exportResult(session); const parsed = JSON.parse(json); const restored = importResult(json);
  assert.equal(parsed.schema, 'answer-lens-result/2'); assert.deepEqual(parsed.caveats, [...CAVEATS]);
  assert.deepEqual(restored, { ...session, remember: false });
  assert.equal(exportResult(restored), json);
  assert.equal(parsed.assessment, 'human-self-report'); assert.equal('accuracyScore' in parsed, false);
});
test('tampered shuffle, invalid supplied ratings, wrong schema and malformed JSON are rejected', () => {
  const parsed = JSON.parse(exportResult(result()));
  parsed.comparison.randomization.order.reverse(); assert.throws(() => importResult(JSON.stringify(parsed)), /seed/);
  const invalid = result(); invalid.ratings.A.clarity = 9; assert.throws(() => validateSession(invalid));
  for (const json of ['{', '{}', 'null', '{"schema":"another-app"}', 'x'.repeat(LIMITS.json + 1)]) assert.throws(() => importResult(json));
});
test('saved phase invariants are enforced and unknown fields do not enter state', () => {
  const setup = emptySession(); setup.verdict = 'A'; assert.throws(() => validateSession(setup));
  const session = result(); session.untrustedExtra = '<script>bad</script>';
  assert.equal('untrustedExtra' in validateSession(session), false);
});
test('reset factory has no old question, answers, origins, ratings, consent or mapping', () => {
  const previous = result(); const reset = emptySession();
  assert.equal(reset.question, ''); assert.equal(reset.remember, false); assert.equal(reset.note, '');
  assert.equal(reset.verdict, null); assert.equal(reset.randomization, null); assert.equal(reset.lockedAt, null);
  assert.deepEqual(reset.inputs, [{ origin: '', text: '' }, { origin: '', text: '' }]);
  assert.deepEqual(reset.ratings, { A: {}, B: {} }); assert.notDeepEqual(previous, reset);
});
test('HTML-looking content remains exact text through export/import', () => {
  const session = rated(); const payload = '<img src=x onerror="globalThis.pwned=1"><script>alert(1)</script>&lt;b&gt;';
  session.inputs[0].text = payload; session.inputs[1].origin = payload.slice(0, 100);
  const restored = importResult(exportResult(lockAndReveal(session, 'A', payload, later)));
  assert.equal(restored.inputs[0].text, payload); assert.equal(restored.note, payload);
});
test('renderer has no HTML interpretation APIs or external network calls', async () => {
  const code = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.match(code, /document\.createTextNode/);
});
test('the demo is complete, explicitly synthetic, and has no named real model output', () => {
  const demo = demoSession(); assert.equal(demo.synthetic, true); assert.equal(demo.remember, false);
  assert.ok(demo.question.length > 20); assert.ok(demo.inputs.every(input => input.text.length > 100 && input.origin.startsWith('Synthetic example')));
});
