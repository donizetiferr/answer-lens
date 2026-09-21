import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicDemo } from '../scripts/demo.mjs';
import { importResult, exportResult } from '../src/core.js';

test('the runnable Node demo returns identical bytes on repeated calls', () => {
  assert.equal(deterministicDemo(), deterministicDemo());
});
test('the deterministic demo exports a complete, clearly synthetic local result', () => {
  const result = importResult(deterministicDemo());
  assert.equal(result.synthetic, true);
  assert.equal(result.remember, false);
  assert.equal(result.phase, 'revealed');
  assert.equal(result.verdict, 'tie');
  assert.equal(result.randomization.seed, 20260921);
  assert.equal(result.lockedAt, '2026-09-21T12:01:00.000Z');
  assert.match(result.note, /scripted ratings/);
  for (const label of ['A', 'B']) assert.deepEqual(result.ratings[label], { usefulness: 4, clarity: 4, factualConfidence: 'unsure' });
});
test('the deterministic demo survives an exact export-import-export roundtrip', () => {
  const json = deterministicDemo();
  assert.equal(exportResult(importResult(json)), json);
});
