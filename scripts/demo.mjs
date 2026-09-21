// Deterministic, network-free Node demo. Ratings/times are illustrative fixtures.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { beginBlind, comparisonView, setRating, lockAndReveal, exportResult, importResult, METRICS, LABELS } from '../src/core.js';
import { demoSession } from '../src/demo.js';

export function deterministicDemo() {
  let session = beginBlind(demoSession(false), { seed: 20260921, now: '2026-09-21T12:00:00.000Z' });
  const blind = comparisonView(session);
  assert.equal(blind.revealed, false);
  for (const answer of blind.answers) assert.equal(Object.hasOwn(answer, 'origin'), false);
  for (const label of LABELS) for (const metric of METRICS) {
    session = setRating(session, label, metric, metric === 'factualConfidence' ? 'unsure' : 4);
  }
  session = lockAndReveal(session, 'tie', 'Synthetic demo: scripted ratings and fixed timestamps, not an actual human evaluation.', '2026-09-21T12:01:00.000Z');
  const json = exportResult(session);
  assert.equal(exportResult(importResult(json)), json);
  return json;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(deterministicDemo() + '\n');
}
