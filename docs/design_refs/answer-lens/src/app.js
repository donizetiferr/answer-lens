import { VERSION, LIMITS, METRICS, LABELS, emptySession, beginBlind, comparisonView, setRating, lockAndReveal, exportResult, importResult, nextPair } from './core.js';
import { STORAGE_KEY, LOCK_NAME, loadLocal, saveLocal, clearLocal, loadLegacy } from './storage.js';
import { metricNames, ratingText, verdictText, decisionNote, preferredAnswer } from './output.js';
import { demoSession } from './demo.js';

const $ = selector => document.querySelector(selector);
// All dynamic content is rendered as text nodes or input values, never HTML.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key in node && !key.startsWith('aria-') && key !== 'role') node[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  if (tag === 'button' || (tag === 'a' && String(attrs.href || '').startsWith('#'))) {
    node.dataset.acao = attrs.id || (tag === 'a' ? 'scroll-comparison' : 'comparison-action');
  }
  return node;
}
const loaded = loadLocal();
let session = loaded.session || emptySession();
let imported = false;
let downloadUrl = null;
let localRaw = loaded.raw;
let protectedData = !!loaded.protected;
let externalChanged = false;
let dataState = protectedData ? 'protected' : loaded.session ? 'saved' : loaded.ok ? 'tab' : 'failed';
let dataMessage = loaded.message || '';
let saveTicket = 0, viewTicket = 0, fileTicket = 0;
let saveQueue = Promise.resolve();
let navObserver;
const say = message => { $('#status').textContent = message; };
function fail(message) { $('#error').hidden = false; $('#error').textContent = message; $('#error').focus(); }
function clearError() { $('#error').hidden = true; $('#error').textContent = ''; }
function updateDataStatus() {
  const messages = {
    tab: 'Saving is off — this tab only. Reloading or closing can lose this comparison.',
    saved: 'Saved on this device — plain text, not encrypted. Nothing is uploaded.',
    saving: 'Saving on this device… Keep this tab open until it is saved.',
    clearing: 'Removing this tab’s previous saved copy… Current work stays in this tab.',
    failed: dataMessage || 'Not saved. Copy or export before leaving.',
    conflict: 'Another tab changed saved data. Your work stays here; saving is off. Enable saving to choose whether to replace that saved copy.',
    protected: dataMessage || 'A newer or unreadable saved comparison was left untouched. Work in this tab; this version will not replace it.',
    'delete-failed': dataMessage
  };
  $('#data-status').textContent = messages[dataState];
  $('#data-status').dataset.state = dataState;
  if ($('#save-feedback')) $('#save-feedback').textContent = ({ tab: 'Not saved on this device.', saved: 'Saved.', saving: 'Saving…', clearing: 'Clearing the previous saved copy…', failed: 'Not saved. Retry above, or copy/export the result.', conflict: 'Saving is off: another tab changed the saved copy.', protected: 'This version cannot replace the saved copy.', 'delete-failed': 'The saved copy may remain. See the status above.' })[dataState];
  $('#save-retry').hidden = !session.remember || !['failed'].includes(dataState);
  if ($('#remember')) { $('#remember').checked = session.remember; $('#remember').disabled = protectedData; }
}
async function storageLock(action) {
  if (!navigator.locks?.request) return { ok: false, message: 'Not saved. Safe device saving needs browser lock support. Keep this tab open, or copy/export your result.' };
  return navigator.locks.request(LOCK_NAME, action);
}
function observeWrite(result) {
  if (result.ok) { localRaw = result.raw; dataMessage = ''; return; }
  dataMessage = result.message;
  if (result.protected) { protectedData = true; session.remember = false; dataState = 'protected'; }
  else if (result.conflict) { externalChanged = true; session.remember = false; dataState = 'conflict'; }
  else dataState = 'failed';
}
function persist() {
  const ticket = ++saveTicket;
  if (!session.remember || protectedData || externalChanged) { updateDataStatus(); return; }
  const snapshot = structuredClone(session);
  dataState = 'saving'; updateDataStatus();
  // Coalesce obsolete keystrokes; serialize cooperative v2 tabs with a Web Lock.
  saveQueue = saveQueue.then(async () => {
    if (ticket !== saveTicket || !session.remember) return null;
    return storageLock(() => ticket !== saveTicket ? null : saveLocal(snapshot, () => localStorage, localRaw));
  }).then(result => {
    if (!result) return;
    if (result.ok) localRaw = result.raw;
    if (ticket !== saveTicket) return;
    observeWrite(result);
    if (result.ok) dataState = 'saved';
    updateDataStatus();
  }).catch(() => {
    if (ticket !== saveTicket) return;
    dataState = 'failed'; dataMessage = 'Not saved. Device saving failed. Copy or export before leaving.'; updateDataStatus();
  });
}
async function clearOwnedData() {
  ++saveTicket;
  if (!protectedData && !externalChanged) { dataState = 'clearing'; updateDataStatus(); }
  const clearing = saveQueue.then(async () => {
    if (protectedData || externalChanged) return { ok: false, kept: true };
    let result;
    try { result = await storageLock(() => clearLocal(() => localStorage, localRaw)); }
    catch { result = { ok: false, message: 'The saved copy could not be deleted. It may remain on this device.' }; }
    observeWrite(result);
    if (!result.ok && !result.conflict && !result.protected) dataState = 'delete-failed';
    if (result.ok) dataState = 'tab';
    return result;
  });
  saveQueue = clearing.then(() => {}, () => {});
  return clearing;
}
function enableSaving() {
  session.remember = true;
  if (externalChanged) {
    session.remember = false;
    const current = loadLocal();
    if (!current.ok) { observeWrite(current); updateDataStatus(); return; }
    confirmAction('Replace the saved comparison?', 'Another tab changed the saved copy. This will save the comparison in this tab instead. Other open tabs keep their own work.', 'Save this tab instead', () => {
      localRaw = current.raw; externalChanged = false; session.remember = true; persist();
    });
    updateDataStatus(); return;
  }
  persist();
}
function saveChoice() {
  return el('label', { class: 'save-choice' },
    el('input', { id: 'remember', type: 'checkbox', checked: session.remember, disabled: protectedData, onchange: async event => {
      if (event.target.checked) enableSaving();
      else { session.remember = false; await clearOwnedData(); updateDataStatus(); }
    }}),
    el('span', {}, 'Save this comparison on this device', el('small', {}, 'Optional. The offline app cache does not save your answers.'), el('small', { id: 'save-feedback' }, '')));
}
function privacyNote() {
  return el('details', { class: 'privacy' }, el('summary', {}, 'What is hidden, and what stays on my device?'),
    el('p', {}, 'Source fields disappear during comparison. You may still recognize an answer you pasted, or a model may name itself in the text. This is a small bias-reduction aid, not a secure blind experiment. For less familiarity, ask someone else to paste the answers.'),
    el('p', {}, 'No answer is sent anywhere by this app. Saving is optional and keeps one v2 comparison in local browser storage. Older v1 data stays separate and is never changed by this version. Browser tools, extensions, or another person using this browser may read it. Use a private device for sensitive text. Reset clears this tab and its own current v2 saved copy when deletion succeeds. Other tabs, older v1 data, your clipboard, downloaded files and the offline app cache remain.'),
    el('p', {}, 'The app does not call a model, verify sources, or calculate factual accuracy. Origins are whatever you enter. There is no leaderboard.'));
}
function steps(phase) {
  const current = ['setup', 'blind', 'revealed'].indexOf(phase);
  return el('ol', { class: 'steps', 'aria-label': 'Comparison progress' }, ['Prepare', 'Compare blind', 'Reveal'].map((name, index) =>
    el('li', { class: index <= current ? 'active' : '', ...(index === current ? { 'aria-current': 'step' } : {}) },
      el('span', { 'aria-hidden': 'true' }, index < current ? '✓' : String(index + 1).padStart(2, '0')), name)));
}
function demoNotice() {
  return session.synthetic ? el('div', { class: 'notice demo-notice' }, el('strong', {}, 'Synthetic demo'), ' · These are written examples, not measured outputs from real models. Your ratings are your own.') : null;
}
function textInput(id, label, value, max, onChange, { area = false, placeholder = '', rows = 5 } = {}) {
  const count = el('span', { id: `${id}-count`, class: 'char-count' }, `${value.length.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`);
  const field = el(area ? 'textarea' : 'input', { id, name: id, value, maxLength: max, placeholder,
    ...(area ? { rows } : { type: 'text' }), autocomplete: 'off', spellcheck: false,
    required: id === 'question' || /^answer-/.test(id), 'aria-describedby': `${id}-count`, oninput: event => { onChange(event.target.value); count.textContent = `${event.target.value.length.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`; persist(); } });
  return el('div', { class: 'field' }, el('div', { class: 'label-line' }, el('label', { htmlFor: id }, label), count), field);
}
function renderSetup() {
  const hero = el('section', { class: 'hero' }, el('div', {}, el('p', { class: 'eyebrow' }, 'A clearer way to compare AI'),
    el('h1', { tabindex: -1 }, 'Judge the answer.', el('br'), el('span', { class: 'serif' }, 'Not the name.')),
    el('p', { class: 'intro' }, 'Paste two answers to the same question. Read with the names hidden, decide what helps you, then see who wrote what.')),
    el('aside', { class: 'hero-note' }, el('span', { class: 'note-index' }, 'A / B'), el('p', {}, 'Your judgment,', el('br'), 'before the reveal.'), el('small', {}, 'A small experiment.', el('br'), 'Not a model ranking.')));
  const demoButton = el('button', { type: 'button', id: 'demo-button', class: 'button secondary', onclick: () => {
    const apply = () => { session = demoSession(session.remember); imported = false; persist(); render(true); say('Synthetic demo loaded. Read the question, then hide the names to begin.'); };
    if (session.question || session.inputs.some(input => input.text || input.origin)) confirmAction('Replace this draft?', 'The synthetic demo will replace the question and both answers in this draft.', 'Load demo', apply);
    else apply();
  } }, 'Try the synthetic demo', el('span', { 'aria-hidden': 'true' }, ' ↗'));
  const form = el('form', { id: 'setup-form', noValidate: true, onsubmit: event => {
    event.preventDefault(); clearError();
    try {
      if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomization is unavailable in this browser. Use a current browser on localhost or HTTPS.');
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      session = beginBlind(session, { seed }); imported = false; persist(); render(true); say('Sources hidden. Choose your verdict when ready; detailed ratings are optional.');
    } catch (error) { fail(error.message); }
  } },
    el('section', { class: 'editor-section' },
      el('div', { class: 'section-heading' }, el('div', {}, el('h2', {}, 'Start with a real question.'), el('p', {}, 'Use the same question for both answers. All three text boxes are required.')), demoButton),
      demoNotice(),
      textInput('question', 'Your question', session.question, LIMITS.question, value => { session.question = value; }, { area: true, rows: 2, placeholder: 'For example: How can I tidy my downloads folder in 15 minutes?' }),
      el('div', { class: 'answer-grid input-grid' }, session.inputs.map((input, index) => el('section', { class: 'input-card' },
        el('div', { class: 'card-top' }, el('h3', {}, index === 0 ? 'First answer' : 'Second answer'), el('span', { class: 'micro' }, 'Shuffled in the next step')),
        textInput(`origin-${index}`, 'Source name (optional)', input.origin, LIMITS.origin, value => { session.inputs[index].origin = value; }, { placeholder: 'Model, app, or a name you choose' }),
        textInput(`answer-${index}`, 'Answer text', input.text, LIMITS.answer, value => { session.inputs[index].text = value; }, { area: true, rows: 9, placeholder: 'Paste the full answer here. Plain text works best.' })
      ))),
      el('div', { class: 'start-row' }, saveChoice(), el('button', { type: 'submit', id: 'begin-button', class: 'button primary' }, 'Hide names & compare', el('span', { 'aria-hidden': 'true' }, ' →'))),
      el('p', { class: 'subtle small' }, 'Remove self-identifying phrases first when practical. You may still recognize answers you pasted.')),
    privacyNote());
  const importer = el('div', { class: 'import-row' }, el('label', { htmlFor: 'import-file', class: 'import-label' }, 'Already have a result? Open a saved JSON'),
    el('input', { type: 'file', id: 'import-file', accept: '.json,application/json', onchange: openResult }), el('span', { class: 'small subtle' }, 'Opens locally. Nothing is uploaded.'));
  return [hero, steps(session.phase), form, importer, olderComparison()];
}
async function openResult(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const request = ++fileTicket, view = viewTicket;
  clearError();
  try {
    if (file.size > LIMITS.json) throw new Error('Result file is too large (maximum 600 KB).');
    const json = await file.text();
    if (request !== fileTicket || view !== viewTicket) return;
    const restored = importResult(json);
    const apply = () => replaceCurrent(restored, true, 'Opened a previously revealed result in this tab only. This is a local record, not a new blind trial.');
    if (session.question || session.inputs.some(input => input.text || input.origin)) confirmAction('Open this result instead?', 'This will replace the current draft. The result already contains revealed origins.', 'Open result', apply);
    else apply();
  } catch (error) {
    if (request !== fileTicket || view !== viewTicket) return;
    fail(error.message); event.target.value = '';
  }
}

const metricHints = { usefulness: 'Does it help you do what you asked?', clarity: 'Is it easy to follow?', factualConfidence: 'Your confidence, not a fact-check.' };
function ratingGroup(label, metric, value) {
  const name = `${label}-${metric}`;
  const options = [1, 2, 3, 4, 5, ...(metric === 'factualConfidence' ? ['unsure'] : [])];
  return el('fieldset', { class: 'rating-group' }, el('legend', {}, `${metricNames[metric]} · Answer ${label}`),
    el('p', { id: `${name}-hint`, class: 'rating-hint' }, metricHints[metric]),
    el('div', { class: 'rating-options' }, options.map(option => el('label', { class: `rating-option${option === 'unsure' ? ' unsure' : ''}` },
      el('input', { type: 'radio', name, value: String(option), checked: value === option, 'aria-describedby': `${name}-hint`,
        'aria-label': option === 'unsure' ? 'Not sure' : `${option}${option === 1 ? ' — low' : option === 5 ? ' — high' : ''}`,
        onchange: () => { session = setRating(session, label, metric, option); persist(); } }),
      el('span', {}, option === 'unsure' ? 'Not sure' : option)))),
    el('div', { class: 'scale-ends', 'aria-hidden': 'true' }, el('span', {}, '1 · Low'), el('span', {}, '5 · High')));
}
function answerCard(answer, revealed) {
  return el('article', { class: 'answer-card', 'aria-labelledby': `title-${answer.label}`, 'data-label': answer.label, id: `answer-${answer.label}`, tabindex: -1 },
    el('header', { class: 'answer-heading' }, el('div', { class: 'answer-heading-title' }, el('span', { class: 'letter', 'aria-hidden': 'true' }, answer.label),
      el('div', {}, el('h2', { id: `title-${answer.label}` }, `Answer ${answer.label}`),
        el('p', { class: revealed ? 'origin' : 'hidden-origin' }, revealed ? answer.origin : 'Source hidden'))),
      el('span', { class: 'answer-tag' }, revealed ? 'Revealed' : 'Read first')),
    el('div', { class: 'answer-text', dir: 'auto' }, answer.text),
    revealed ? el('div', { class: 'rating-area' },
      el('dl', { class: 'rating-results' }, METRICS.map(metric => el('div', {}, el('dt', {}, metricNames[metric]), el('dd', {}, ratingText(answer.ratings[metric])))))) : null);
}
function verdictForm() {
  const optionalRatings = el('details', { id: 'details-ratings', class: 'optional-ratings', open: LABELS.some(label => Object.keys(session.ratings[label]).length > 0) },
    el('summary', {}, 'Add detailed ratings (optional)'),
    el('p', { class: 'small subtle' }, 'Leave any item unrated. “Not sure” records uncertainty; factual confidence is not a fact-check.'),
    el('div', { class: 'answer-grid' }, LABELS.map(label => el('section', { class: 'detail-rating-card', 'aria-label': `Optional ratings for Answer ${label}` },
      el('h3', {}, `Answer ${label}`), METRICS.map(metric => ratingGroup(label, metric, session.ratings[label][metric]))))),
    el('button', { id: 'clear-ratings', type: 'button', class: 'button secondary', onclick: () => {
      session.ratings = { A: {}, B: {} };
      document.querySelectorAll('#details-ratings input[type=radio]').forEach(input => { input.checked = false; });
      persist(); say('Optional ratings cleared. Your verdict and reason were kept.');
    } }, 'Clear optional ratings'));
  return el('form', { id: 'verdict-form', class: 'verdict-panel', noValidate: true, onsubmit: event => {
    event.preventDefault(); clearError();
    if (!['A', 'B', 'tie', 'neither'].includes(session.verdict)) {
      $('#verdict-error').hidden = false;
      $('#verdict-group').setAttribute('aria-invalid', 'true');
      $('#verdict-group').scrollIntoView({ block: 'start' });
      $('input[name="verdict"]').focus({ preventScroll: true });
      return;
    }
    try { session = lockAndReveal(session, session.verdict, session.note); persist(); render(true); say('Your verdict is locked. Sources are now revealed.'); }
    catch (error) { fail(error.message); }
  } },
    el('div', { class: 'section-heading' }, el('div', {}, el('p', { class: 'eyebrow' }, 'Your call'), el('h2', { id: 'decision-title', tabindex: -1 }, 'Which would you rather use?'))),
    el('fieldset', { id: 'verdict-group', class: 'verdict-group', 'aria-describedby': 'verdict-error' }, el('legend', { class: 'sr-only' }, 'Your verdict (required)'),
      el('div', { class: 'verdict-options' }, [['A', 'Answer A'], ['B', 'Answer B'], ['tie', 'A tie'], ['neither', 'Neither']].map(([value, label]) =>
        el('label', { class: 'verdict-option' }, el('input', { type: 'radio', name: 'verdict', value, required: true, checked: session.verdict === value,
          onchange: () => { session.verdict = value; $('#verdict-error').hidden = true; $('#verdict-group').removeAttribute('aria-invalid'); persist(); } }), el('span', {}, label))))),
    el('p', { id: 'verdict-error', class: 'inline-error', role: 'alert', hidden: true }, 'Choose Answer A, Answer B, a tie, or neither before revealing the sources.'),
    textInput('note', 'What tipped the balance? (optional)', session.note, LIMITS.note, value => { session.note = value; }, { area: true, rows: 2, placeholder: 'A useful detail, a missing step, or a claim you would check…' }),
    optionalRatings,
    el('div', { class: 'start-row' }, el('p', { class: 'small subtle' }, 'Only your verdict is required. Your reason and any ratings lock before the names appear.'),
      el('button', { id: 'reveal-button', class: 'button primary', type: 'submit' }, 'Lock verdict & reveal', el('span', { 'aria-hidden': 'true' }, ' →'))));
}
function readingNav(revealed) {
  return el('nav', { class: 'reader-nav', 'aria-label': 'Move between full answers and your decision' },
    [['A', 'Answer A'], ['B', 'Answer B'], ['decision', revealed ? 'Your result' : 'Your decision']].map(([id, label]) => {
      const target = id === 'decision' ? '#decision-title' : `#answer-${id}`;
      return el('a', { href: target, onclick: event => {
        event.preventDefault(); $(target).scrollIntoView({ block: 'start' }); $(target).focus({ preventScroll: true });
      } }, label);
    }));
}
async function copyOutput(kind) {
  const ticket = viewTicket;
  const text = kind === 'answer' ? preferredAnswer(session) : decisionNote(session);
  const label = kind === 'answer' ? 'Preferred answer' : 'Decision note';
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (ticket === viewTicket) say(`${label} copied. Review it before sharing; it may contain private text.`);
  } catch {
    if (ticket !== viewTicket) return;
    $('#copy-fallback').hidden = false; $('#copy-label').textContent = `${label} — select and copy`;
    $('#copy-text').value = text; $('#copy-text').focus(); $('#copy-text').select();
    say('Automatic copy is unavailable. The full plain text is selected below; use your device’s Copy command.');
  }
}
function copyFallback() {
  return el('section', { id: 'copy-fallback', class: 'copy-fallback', hidden: true, 'aria-label': 'Plain-text copy fallback' },
    el('label', { id: 'copy-label', htmlFor: 'copy-text' }, 'Select and copy'),
    el('p', { class: 'small subtle' }, 'Nothing was uploaded. Use your keyboard or your device’s text-selection menu to copy.'),
    el('textarea', { id: 'copy-text', readOnly: true, rows: 9, spellcheck: false }),
    el('button', { type: 'button', class: 'button secondary', id: 'select-copy-text', onclick: () => { $('#copy-text').focus(); $('#copy-text').select(); } }, 'Select all text'));
}
function revealSummary(view) {
  const preference = view.answers.find(answer => answer.label === session.verdict);
  const audit = session.randomization;
  return el('section', { class: 'reveal-summary', 'aria-label': 'Your locked result' },
    el('div', { class: 'reveal-top' }, el('div', {}, el('p', { class: 'eyebrow' }, imported ? 'Opened result · already revealed' : 'Verdict locked · sources revealed'),
      el('h2', { id: 'decision-title', tabindex: -1 }, verdictText(session.verdict)), preference ? el('p', { class: 'chosen-origin' }, preference.origin) : null),
      el('button', { type: 'button', id: 'copy-note', class: 'button primary', onclick: () => copyOutput('note') }, 'Copy decision note')),
    el('div', { class: 'result-actions' },
      preference ? el('button', { type: 'button', id: 'copy-answer', class: 'button secondary', onclick: () => copyOutput('answer') }, 'Copy preferred answer') : null,
      el('button', { type: 'button', id: 'export-button', class: 'button secondary', onclick: downloadResult }, 'Export full result JSON'),
      el('button', { type: 'button', id: 'next-pair', class: 'button secondary', onclick: () => confirmAction('Compare another pair?', 'Copy or export this result before replacing it. Only the question will carry over. This tab’s current result and its own saved copy will be cleared; downloaded files remain.', 'Keep question & start again', () => replaceCurrent(nextPair(session))) }, 'Another pair for this question')),
    copyFallback(),
    session.note ? el('div', { class: 'result-note' }, el('strong', {}, 'Your note'), el('p', {}, session.note)) : null,
    el('p', { class: 'result-caveat' }, 'This is your preference on one question, not proof that a model is better. Factual confidence is your judgment, not verified accuracy. Source names are supplied by you.'),
    el('details', { class: 'audit-details' }, el('summary', {}, 'See the recorded shuffle'),
      el('p', {}, `Algorithm: ${audit.algorithm}. Seed: ${audit.seed}.`),
      el('p', {}, `Answer A came from input ${audit.order[0] + 1}; Answer B came from input ${audit.order[1] + 1}.`),
      el('p', {}, `Assigned: ${audit.assignedAt}. Verdict locked: ${session.lockedAt}.`),
      el('p', {}, 'The export includes the full question, both answers, user-supplied origins, all ratings you supplied (omitted items stay Not rated), your verdict and note, this mapping, and the limitations. A local JSON file is editable; it is not a signed audit record.')));
}
function renderComparison() {
  const view = comparisonView(session);
  return [el('section', { class: 'compact-hero' }, el('p', { class: 'eyebrow' }, view.revealed ? 'Look past the label' : 'Names out. Judgment in.'),
    el('h1', { tabindex: -1 }, view.revealed ? 'Your verdict came first.' : 'Which answer works for you?'),
    el('p', { class: 'intro' }, view.revealed ? 'Keep the result as a snapshot of what helped you with this question.' : 'Read both answers and choose what helps you. Detailed ratings are optional; names stay hidden until you decide.')),
    steps(session.phase), demoNotice(), readingNav(view.revealed),
    el('section', { class: 'question-card', 'aria-labelledby': 'shared-question' }, el('p', { id: 'shared-question', class: 'eyebrow' }, 'The same question'), el('p', { class: 'question-text', dir: 'auto' }, view.question)),
    view.revealed ? revealSummary(view) : el('p', { class: 'comparison-tip' }, 'Read the full answers. Choose a tie or neither when appropriate; you do not need to invent a score.'),
    el('div', { class: 'answer-grid comparison-grid' }, view.answers.map(answer => answerCard(answer, view.revealed))),
    view.revealed ? null : verdictForm(),
    el('div', { class: 'comparison-save' }, saveChoice()), privacyNote()];
}
function downloadResult() {
  try {
    const json = exportResult(session);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = el('a', { href: downloadUrl, download: `answer-lens-${session.lockedAt.slice(0, 10)}.json` });
    document.body.append(link); link.click(); link.remove();
    const url = downloadUrl; setTimeout(() => { URL.revokeObjectURL(url); if (downloadUrl === url) downloadUrl = null; }, 1000);
    say('Result download requested. The JSON includes both full answers and source names; share it carefully.');
  } catch (error) { fail(error.message); }
}
function render(focus = false) {
  clearError(); ++viewTicket; navObserver?.disconnect();
  const children = session.phase === 'setup' ? renderSetup() : renderComparison();
  // replaceChildren stringifies null/undefined; omitted sections must stay absent.
  $('#app').replaceChildren(...children.filter(child => child !== null && child !== undefined));
  document.documentElement.dataset.phase = session.phase;
  document.title = `Answer Lens — ${session.phase === 'setup' ? 'judge the answer, not the name' : session.phase === 'blind' ? 'compare blind' : 'your result'}`;
  updateDataStatus();
  const nav = $('.reader-nav');
  if (nav) {
    const sizeNav = () => document.documentElement.style.setProperty('--reader-nav-height', `${nav.getBoundingClientRect().height}px`);
    sizeNav();
    if ('ResizeObserver' in window) { navObserver = new ResizeObserver(sizeNav); navObserver.observe(nav); }
  }
  if (focus) { window.scrollTo(0, 0); $('#app h1').focus({ preventScroll: true }); }
}
let pendingAction = null;
function confirmAction(title, description, button, action) {
  $('#reset-heading').textContent = title; $('#reset-description').textContent = description;
  $('#confirm-reset').textContent = button; pendingAction = action; $('#reset-dialog').showModal();
}
async function replaceCurrent(next, opened = false, message = 'Comparison cleared. This tab no longer contains the previous answers or ratings.') {
  session = next; session.remember = false; imported = opened;
  if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
  const cleanup = clearOwnedData();
  render(true); const ticket = viewTicket;
  await cleanup; updateDataStatus();
  if (ticket === viewTicket) say(message);
}
function reset() { return replaceCurrent(emptySession()); }
function hasWork() { return !!(session.question || session.inputs.some(input => input.text || input.origin)); }
function olderComparison() {
  const older = loadLegacy();
  if (!older.session) return null;
  return el('section', { class: 'legacy-notice' }, el('h2', {}, 'Have a comparison from the earlier app?'),
    el('p', { class: 'small subtle' }, 'Open the older v1 saved copy in this tab. Its original stays untouched; saving the new copy is a separate choice. Reset here does not delete the older copy.'),
    el('button', { id: 'legacy-button', class: 'button secondary', type: 'button', onclick: () => {
      const fresh = loadLegacy();
      if (!fresh.session) { fail(fresh.message || 'The older saved comparison is no longer available.'); return; }
      const apply = () => replaceCurrent(fresh.session, fresh.session.phase === 'revealed', 'Opened an older comparison in this tab only. The original v1 saved copy was left untouched.');
      if (hasWork()) confirmAction('Open the older comparison instead?', 'This replaces this tab’s comparison. Copy or export a finished result first. The original v1 saved data is left untouched.', 'Open older comparison', apply);
      else apply();
    } }, 'Open older saved comparison'));
}
$('#reset-button').addEventListener('click', () => confirmAction('Clear this comparison?', 'This clears this tab and its own current v2 saved copy when deletion succeeds. Other tabs, older v1 data, your clipboard, downloaded files and the offline app cache remain.', 'Clear comparison', reset));
$('#cancel-reset').addEventListener('click', () => { pendingAction = null; $('#reset-dialog').close(); updateDataStatus(); });
$('#confirm-reset').addEventListener('click', () => {
  const action = pendingAction; pendingAction = null; $('#reset-dialog').close();
  Promise.resolve().then(() => action?.()).catch(error => fail(error.message));
});
$('#reset-dialog').addEventListener('cancel', () => { pendingAction = null; updateDataStatus(); });
$('#save-retry').addEventListener('click', persist);
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try { if (event.storageArea !== localStorage) return; } catch { return; }
  const current = loadLocal();
  if (current.ok && current.raw === localRaw) return;
  // Never re-render, replace the draft, steal focus or silently accept another tab's data.
  ++saveTicket; session.remember = false; externalChanged = true;
  protectedData = !!current.protected;
  dataState = protectedData ? 'protected' : 'conflict'; dataMessage = current.message || '';
  updateDataStatus();
});
window.addEventListener('beforeunload', event => {
  // Best effort only: mobile browsers need not display this warning.
  if (hasWork() && dataState !== 'saved') { event.preventDefault(); event.returnValue = ''; }
});
render();
if (loaded.message) say(loaded.message);
else if (loaded.session) say('Restored the comparison you chose to save on this device.');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    $('#offline-status').textContent = `Offline app ready · v${VERSION}`;
  }).catch(() => { $('#offline-status').textContent = 'Offline cache unavailable · keep this tab open'; });
} else $('#offline-status').textContent = 'Offline cache unsupported · keep this tab open';
