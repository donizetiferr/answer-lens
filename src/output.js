// Pure, inert plain-text outputs. No clipboard access, DOM, or invented scores.
import { validateSession, comparisonView, METRICS } from './core.js';
export const metricNames = Object.freeze({ usefulness: 'Usefulness', clarity: 'Clarity', factualConfidence: 'Factual confidence' });
export const ratingText = value => value === undefined ? 'Not rated' : value === 'unsure' ? 'Not sure' : `${value} / 5`;
export const verdictText = verdict => ({ A: 'You preferred Answer A.', B: 'You preferred Answer B.', tie: 'You called it a tie.', neither: 'Neither answer met your needs.' }[verdict]);
function revealed(session) {
  const valid = validateSession(session);
  if (valid.phase !== 'revealed') throw new Error('Lock your verdict and reveal before copying a result.');
  return valid;
}
export function decisionNote(session) {
  const valid = revealed(session);
  const view = comparisonView(valid);
  return [
    'Answer Lens — personal decision note',
    ...(valid.synthetic ? ['SYNTHETIC DEMO: illustrative answers, not measured model outputs.'] : []),
    '', 'Question', valid.question, '', 'My decision', verdictText(valid.verdict),
    '', 'My reason', valid.note || 'No reason recorded.', '', 'Sources (user-supplied)',
    ...view.answers.map(answer => `Answer ${answer.label}: ${answer.origin}`),
    '', 'Optional ratings', ...view.answers.flatMap(answer => [
      `Answer ${answer.label}`, ...METRICS.map(metric => `  ${metricNames[metric]}: ${ratingText(answer.ratings[metric])}`)
    ]),
    '', `Verdict locked: ${valid.lockedAt}`, '',
    'This is a personal preference on one question, not a model ranking or proof of accuracy. Factual confidence is subjective. Sources are not authenticated. Not rated means no judgment was supplied.',
    'The complete question and user-entered reason are included above; share carefully. Full answers and the recorded shuffle are available in the result JSON.'
  ].join('\n');
}
export function preferredAnswer(session) {
  const valid = revealed(session);
  if (!['A', 'B'].includes(valid.verdict)) throw new Error('A tie or neither has no preferred answer to copy.');
  const answer = comparisonView(valid).answers.find(item => item.label === valid.verdict);
  return (valid.synthetic ? 'SYNTHETIC EXAMPLE — not a measured model output.\n\n' : '') + answer.text;
}
