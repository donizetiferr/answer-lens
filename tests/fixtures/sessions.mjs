import * as v1 from './v1/core.js';
export function legacySession(phase = 'revealed') {
  let session = { ...v1.emptySession(), synthetic: true, question: 'Which instructions would help with this task?', inputs: [{ origin: 'Synthetic original one', text: 'First complete synthetic answer.' }, { origin: 'Synthetic original two', text: 'Second complete synthetic answer.' }] };
  session = v1.beginBlind(session, { seed: 1, now: '2026-09-21T07:00:00.000Z' });
  if (phase === 'blind') return session;
  for (const label of v1.LABELS) for (const metric of v1.METRICS) session = v1.setRating(session, label, metric, metric === 'factualConfidence' ? 'unsure' : 4);
  return v1.lockAndReveal(session, 'B', 'Illustrative old result.', '2026-09-21T07:01:00.000Z');
}
export const legacyJSON = () => v1.exportResult(legacySession());
