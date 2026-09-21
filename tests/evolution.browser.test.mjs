import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createAppServer, ROOT } from '../scripts/serve.mjs';
import { STORAGE_KEY, LEGACY_KEY } from '../src/storage.js';
import { beginBlind, setRating, lockAndReveal, exportResult, importResult } from '../src/core.js';
import { demoSession } from '../src/demo.js';
import { legacySession, legacyJSON } from './fixtures/sessions.mjs';
let server, browser, base;
const errors = [], externalRequests = [], nonGetRequests = [], captures = [];
// Committed round-2 pictures are historical receipts; normal test runs must not replace them.
const output = join(ROOT, process.env.ANSWER_LENS_CAPTURE_DIR || 'evidence/evolution-root-captures');
before(async () => {
  await mkdir(join(output, 'captures'), { recursive: true });
  server = createAppServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
});
after(async () => {
  try {
    const runtimeHashes = {};
    for (const path of ['index.html', 'styles.css', 'sw.js', 'src/app.js', 'src/core.js', 'src/storage.js', 'src/output.js', 'src/demo.js']) runtimeHashes[path] = createHash('sha256').update(await readFile(join(ROOT, path))).digest('hex');
    await writeFile(join(output, 'captures.json'), JSON.stringify({ schema: 'answer-lens-screen-evidence/1', capturedAt: new Date().toISOString(), browser: browser?.version(), node: process.version, sourceBase: '72bc7ab2bf672ff1cfc480a17c5f06597c85d020', runtimeHashes, captures, pageErrors: errors, externalRequests, nonGetRequests, review: 'Captured by actual Chrome interactions; visual inspection is recorded separately, never inferred from capture success.' }, null, 2) + '\n');
  } finally {
    await browser?.close();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
async function fixture({ viewport = { width: 1440, height: 1000 }, init = null, permissions = [] } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', permissions });
  if (init) await context.addInitScript(init);
  context.on('request', request => {
    if (!request.url().startsWith(base) && !request.url().startsWith('blob:')) externalRequests.push(request.url());
    if (request.method() !== 'GET') nonGetRequests.push(request.method());
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const page = await context.newPage(); page.on('dialog', dialog => dialog.accept());
  await page.goto(base); await page.waitForSelector('#demo-button');
  return { context, page };
}
const choose = (page, name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).click();
async function demo(page) { await page.click('#demo-button'); await page.click('#begin-button'); await page.waitForSelector('#verdict-form'); }
async function reveal(page, verdict = 'B') { await choose(page, 'verdict', verdict); await page.click('#reveal-button'); await page.waitForSelector('#copy-note'); }
async function saved(page) { await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved'); }
async function reset(page) { await page.click('#reset-button'); await page.click('#confirm-reset'); await page.waitForSelector('#question'); }
async function capture(page, name, scenario, fullPage = false) {
  const relative = `captures/evolution-${name}.png`;
  const path = join(output, relative); await page.screenshot({ path, fullPage });
  captures.push({ path: relative, sha256: createHash('sha256').update(await readFile(path)).digest('hex'), viewport: page.viewportSize(), phase: await page.evaluate(() => document.documentElement.dataset.phase), scenario, fullPage });
}
async function tabTo(page, selector) {
  for (let i = 0; i < 45; i++) {
    if (await page.locator(selector).evaluate(node => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  assert.fail(`Keyboard could not reach ${selector}`);
}
function denyCopy() { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText() { throw new DOMException('Denied for regression', 'NotAllowedError'); } } }); }

test('quick decision requires verdict focus, not six scores; synthetic sources stay absent until lock', async () => {
  const { context, page } = await fixture();
  try {
    await page.click('#demo-button'); await capture(page, 'desktop-prepare', 'Populated synthetic editor; device saving remains off.', true);
    const origins = await page.locator('[id^="origin-"]').evaluateAll(nodes => nodes.map(node => node.value));
    await page.click('#begin-button');
    assert.equal(await page.locator('#details-ratings').evaluate(node => node.open), false);
    for (const origin of origins) { assert.ok(!(await page.content()).includes(origin)); assert.ok(!(await page.locator('body').ariaSnapshot()).includes(origin)); }
    assert.equal(await page.locator('#copy-note,#copy-answer,#export-button').count(), 0);
    await capture(page, 'desktop-reading', 'Full synthetic answers; ratings optional and verdict still required.', true);
    await page.click('#reveal-button');
    assert.equal(await page.evaluate(() => document.activeElement.name), 'verdict');
    assert.equal(await page.locator('#verdict-error').isVisible(), true);
    assert.equal(await page.locator('.origin').count(), 0);
    await page.fill('#note', 'Illustrative preference only: these steps are easier to follow.');
    await reveal(page);
    assert.equal(await page.locator('.origin').count(), 2);
    assert.equal(await page.locator('.rating-results dd').evaluateAll(nodes => nodes.every(node => node.textContent === 'Not rated')), true);
    assert.equal(await page.locator('input[name="verdict"]').count(), 0);
    await capture(page, 'desktop-result', 'Locked synthetic result with no invented ratings and useful copy/repeat actions.', true);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, 'mobile-result', 'The complete new synthetic result on a 390px mobile viewport.', true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const promise = page.waitForEvent('download'); await page.click('#export-button');
    const download = await promise; const stream = await download.createReadStream(); const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const result = importResult(Buffer.concat(chunks).toString());
    assert.deepEqual(result.ratings, { A: {}, B: {} }); assert.equal(result.verdict, 'B'); assert.equal(result.synthetic, true);
  } finally { await context.close(); }
});

test('optional ratings survive disclosure changes and remain clearly not rated when omitted', async () => {
  const { context, page } = await fixture();
  try {
    await demo(page); await page.locator('#details-ratings > summary').click();
    await choose(page, 'A-clarity', 4); await choose(page, 'B-factualConfidence', 'unsure');
    await page.fill('#note', 'Keep this reason.'); await choose(page, 'verdict', 'A');
    await page.click('#clear-ratings');
    assert.equal(await page.locator('#details-ratings input:checked').count(), 0);
    assert.equal(await page.inputValue('#note'), 'Keep this reason.');
    assert.equal(await page.locator('input[name="verdict"][value="A"]').isChecked(), true);
    await choose(page, 'A-clarity', 4); await choose(page, 'B-factualConfidence', 'unsure');
    await page.locator('#details-ratings > summary').click(); await page.locator('#details-ratings > summary').click();
    assert.equal(await page.locator('input[name="A-clarity"][value="4"]').isChecked(), true);
    assert.match(await page.locator('#details-ratings').ariaSnapshot(), /Clarity · Answer A/);
    await reveal(page, 'tie'); assert.equal(await page.locator('#copy-answer').count(), 0);
    assert.deepEqual(await page.locator('[data-label="A"] dd').allTextContents(), ['Not rated', '4 / 5', 'Not rated']);
    assert.deepEqual(await page.locator('[data-label="B"] dd').allTextContents(), ['Not rated', 'Not rated', 'Not sure']);
  } finally { await context.close(); }
});

test('real clipboard copies a decision note and the explicitly preferred answer', async () => {
  const { context, page } = await fixture({ permissions: ['clipboard-read', 'clipboard-write'] });
  try {
    await demo(page); await reveal(page, 'A'); await page.click('#copy-note');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Decision note copied'));
    const text = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(text, /SYNTHETIC DEMO/); assert.match(text, /You preferred Answer A/); assert.match(text, /Not rated/);
    const answer = await page.locator('[data-label="A"] .answer-text').innerText();
    await page.click('#copy-answer');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Preferred answer copied'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'SYNTHETIC EXAMPLE — not a measured model output.\n\n' + answer);
    await page.evaluate(() => navigator.clipboard.writeText(''));
  } finally { await context.close(); }
});

test('copy denial exposes selected inert plain text without replacing the result', async () => {
  const { context, page } = await fixture({ init: denyCopy });
  try {
    await demo(page); await reveal(page); await page.click('#copy-note');
    await page.waitForSelector('#copy-fallback:not([hidden])');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'copy-text');
    assert.match(await page.inputValue('#copy-text'), /personal decision note/);
    assert.equal(await page.locator('#copy-text').evaluate(node => node.selectionEnd - node.selectionStart === node.value.length), true);
    await capture(page, 'copy-fallback', 'Denied clipboard permission; full selectable decision note, no upload.');
    await page.click('#copy-answer'); await page.waitForFunction(() => document.querySelector('#copy-text').value.startsWith('SYNTHETIC EXAMPLE'));
    assert.equal(await page.locator('.origin').count(), 2);
  } finally { await context.close(); }
});

test('full long answers are navigable at 390 and 320px, including enlarged text', { timeout: 45000 }, async () => {
  const { context, page } = await fixture({ viewport: { width: 390, height: 844 } });
  try {
    const first = ('Synthetic reading sample. This paragraph is deliberately repeated to exercise long text, not to make a claim about an AI model.\n\n').repeat(400).slice(0, 39990);
    const second = ('A different synthetic explanation for the same reading test. Nothing is shortened or scored automatically.\n\n').repeat(160).slice(0, 14000);
    await page.fill('#question', 'Synthetic long-answer reading test: which explanation would I rather use?');
    await page.fill('#answer-0', first); await page.fill('#answer-1', second); await page.click('#begin-button');
    const texts = await page.locator('.answer-text').allTextContents();
    assert.deepEqual([...texts].sort(), [first, second].sort());
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 760 });
      for (const label of ['A', 'B']) {
        await page.locator(`.reader-nav a[href="#answer-${label}"]`).click();
        assert.equal(await page.evaluate(() => document.activeElement.id), `answer-${label}`);
        await page.evaluate(() => window.scrollBy(0, 450));
        const geometry = await page.locator(`#answer-${label} .answer-heading`).evaluate(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom, navBottom: document.querySelector('.reader-nav').getBoundingClientRect().bottom }));
        assert.ok(geometry.top >= geometry.navBottom - 1); assert.ok(geometry.bottom < (width === 390 ? 844 : 760));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await capture(page, `mobile-${width}-long`, 'Actual unequal long plain-text answers; sticky B identity and A/B/decision navigation.');
      await page.locator('.reader-nav a[href="#decision-title"]').click();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'decision-title');
      await page.locator('#details-ratings > summary').click();
      await choose(page, 'B-factualConfidence', 'unsure');
      await capture(page, `mobile-${width}-decision`, 'Optional answer-specific ratings and required verdict on a narrow viewport.');
      await page.locator('#details-ratings > summary').click();
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await page.locator('.reader-nav a[href="#answer-A"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok(await page.locator('.skip-link').evaluate(node => node.getBoundingClientRect().bottom <= 0), 'An unfocused enlarged skip link must not cover the navigation');
    assert.equal(await page.locator('.reader-nav').evaluate(nav => [...nav.querySelectorAll('a')].every(link => {
      const box = link.getBoundingClientRect();
      return link.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })), true, 'Every enlarged navigation target is unobscured');
    await capture(page, 'mobile-320-enlarged', '320px viewport with CSS root text enlarged to 200%; not a native screen-reader or browser-zoom certification.');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.locator('.reader-nav a[href="#decision-title"]').click();
    await reveal(page, 'neither'); assert.equal(await page.locator('#copy-answer').count(), 0);
  } finally { await context.close(); }
});

test('keyboard-only journey reaches both answers, verdict, optional reason and locked result', async () => {
  const { context, page } = await fixture({ init: denyCopy });
  try {
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter'); await tabTo(page, '#demo-button'); await page.keyboard.press('Enter');
    await tabTo(page, '#begin-button'); await page.keyboard.press('Enter'); await page.waitForSelector('#verdict-form');
    await tabTo(page, '.reader-nav a[href="#answer-A"]'); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'answer-A');
    // The document's native tab order is used, with no injected programmatic focus.
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#answer-B');
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'answer-B');
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'decision-title');
    await tabTo(page, 'input[name="verdict"][value="A"]'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('input[name="verdict"][value="B"]').isChecked(), true);
    await tabTo(page, '#note'); await page.keyboard.type('Illustrative keyboard preference.');
    await tabTo(page, '#reveal-button'); await page.keyboard.press('Enter'); await page.waitForSelector('#copy-note');
    await tabTo(page, '#copy-note'); await page.keyboard.press('Enter'); await page.waitForSelector('#copy-fallback:not([hidden])');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'copy-text');
  } finally { await context.close(); }
});

test('next pair cancellation is lossless; confirmation retains only question and makes a fresh assignment', async () => {
  const { context, page } = await fixture({ init: () => {
    globalThis.testShuffleCalls = 0;
    const original = Crypto.prototype.getRandomValues;
    Crypto.prototype.getRandomValues = function(array) { globalThis.testShuffleCalls++; return original.call(this, array); };
  } });
  try {
    await demo(page); await page.check('#remember'); await page.fill('#note', 'Keep this until replacement is confirmed.'); await reveal(page); await saved(page);
    const prior = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    const question = JSON.parse(prior).question;
    await page.click('#next-pair'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), prior);
    assert.match(await page.locator('.result-note').innerText(), /Keep this until/);
    await page.click('#next-pair'); await page.click('#confirm-reset'); await page.waitForSelector('#question');
    await page.waitForFunction(key => localStorage.getItem(key) === null, STORAGE_KEY);
    assert.equal(await page.inputValue('#question'), question);
    for (const id of ['answer-0', 'answer-1', 'origin-0', 'origin-1']) assert.equal(await page.inputValue(`#${id}`), '');
    assert.equal(await page.locator('#remember').isChecked(), false);
    assert.equal(await page.locator('.demo-notice,#export-button,.origin').count(), 0);
    await capture(page, 'repeat-question', 'Confirmed next pair: only the question remains; old answer-specific data and saving consent are cleared.', true);
    await page.fill('#answer-0', 'Fresh first answer.'); await page.fill('#answer-1', 'Fresh second answer.'); await page.click('#begin-button');
    assert.equal(await page.evaluate(() => globalThis.testShuffleCalls), 2);
    assert.equal(await page.locator('input[name="verdict"]:checked').count(), 0);
    assert.equal(await page.locator('#note').inputValue(), '');
    assert.equal(await page.locator('input[name="A-clarity"]:checked').count(), 0);
  } finally { await context.close(); }
});

test('quota failure remains visible through blind and reveal despite normal workflow messages', async () => {
  const { context, page } = await fixture({ init: () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'answer-lens.session.v2') throw new DOMException('Full for regression', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  } });
  try {
    await page.click('#demo-button'); await page.check('#remember');
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'failed');
    await page.click('#begin-button'); await reveal(page);
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'failed');
    assert.match(await page.locator('#data-status').innerText(), /Not saved/);
    assert.equal(await page.locator('#save-retry').isVisible(), true);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    await page.click('#save-retry'); await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'failed');
    await capture(page, 'save-failure', 'Quota denial remains visible above the locked result; it is not replaced by reveal success.', true);
  } finally { await context.close(); }
});

test('without Web Locks the app stays usable but does not claim safe device saving', async () => {
  const { context, page } = await fixture({ init: () => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }) });
  try {
    await demo(page); await page.check('#remember'); await reveal(page, 'tie');
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'failed');
    assert.match(await page.locator('#data-status').innerText(), /browser lock support/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
  } finally { await context.close(); }
});

test('cross-tab updates preserve draft, selection and focus; stale replacement confirmation cannot overwrite newer work', async () => {
  const { context, page } = await fixture();
  try {
    await page.click('#demo-button'); await page.check('#remember'); await saved(page);
    const other = await context.newPage(); await other.goto(base); await other.waitForSelector('#question');
    await page.fill('#question', 'Current tab draft.'); await saved(page);
    await other.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'conflict');
    await other.fill('#question', 'Other unsaved draft.');
    await other.locator('#question').evaluate(node => node.setSelectionRange(2, 8));
    await page.fill('#question', 'Newer current-tab draft.'); await saved(page);
    assert.equal(await other.inputValue('#question'), 'Other unsaved draft.');
    assert.deepEqual(await other.locator('#question').evaluate(node => [node === document.activeElement, node.selectionStart, node.selectionEnd]), [true, 2, 8]);
    await other.locator('#remember').click(); await other.waitForSelector('#reset-dialog[open]');
    await other.click('#cancel-reset');
    assert.match(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), /Newer current-tab draft/);
    await other.locator('#remember').click(); await other.waitForSelector('#reset-dialog[open]');
    await page.fill('#question', 'Newest while confirmation was open.'); await saved(page);
    await other.click('#confirm-reset');
    await other.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'conflict');
    assert.equal(await other.inputValue('#question'), 'Other unsaved draft.');
    assert.match(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), /Newest while confirmation was open/);
    await other.locator('#remember').click(); await other.click('#confirm-reset'); await saved(other);
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'conflict');
    assert.equal(await page.inputValue('#question'), 'Newest while confirmation was open.');
    assert.match(await other.evaluate(key => localStorage.getItem(key), STORAGE_KEY), /Other unsaved draft/);
  } finally { await context.close(); }
});

test('competing first saves cannot silently overwrite each other; both tab drafts remain', async () => {
  const { context, page } = await fixture();
  try {
    const other = await context.newPage(); await other.goto(base); await other.waitForSelector('#question');
    await page.fill('#question', 'Draft from one tab'); await other.fill('#question', 'Draft from another tab');
    await Promise.all([page.locator('#remember').click(), other.locator('#remember').click()]);
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state !== 'saving');
    await other.waitForFunction(() => document.querySelector('#data-status').dataset.state !== 'saving');
    const states = [await page.locator('#data-status').getAttribute('data-state'), await other.locator('#data-status').getAttribute('data-state')].sort();
    assert.deepEqual(states, ['conflict', 'saved']);
    assert.equal(await page.inputValue('#question'), 'Draft from one tab'); assert.equal(await other.inputValue('#question'), 'Draft from another tab');
  } finally { await context.close(); }
});

async function oldStorageHarness(context) {
  const core = await readFile(join(ROOT, 'tests/fixtures/v1/core.js'), 'utf8');
  const storage = await readFile(join(ROOT, 'tests/fixtures/v1/storage.js'), 'utf8');
  await context.route('**/__v1/core.js', route => route.fulfill({ contentType: 'text/javascript', body: core }));
  await context.route('**/__v1/storage.js', route => route.fulfill({ contentType: 'text/javascript', body: storage }));
  await context.route('**/__v1/test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Frozen v1 storage harness</title><p>Original v1 storage logic, same loopback origin; no production compatibility service is touched.</p>' }));
  const page = await context.newPage(); await page.goto(`${base}/__v1/test.html`);
  return page;
}

test('genuine old v1 code and v2 coexist on one origin; migration is explicit and one-way', async () => {
  const { context, page } = await fixture();
  try {
    const old = await oldStorageHarness(context); const prior = { ...legacySession('blind'), remember: true };
    await old.evaluate(async prior => { const storage = await import('./storage.js'); storage.saveLocal(prior); }, prior);
    const v1Bytes = await old.evaluate(key => localStorage.getItem(key), LEGACY_KEY);
    await page.reload(); await page.waitForSelector('#legacy-button');
    assert.equal(await page.inputValue('#question'), '');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    await page.click('#legacy-button'); await page.waitForSelector('#verdict-form');
    assert.equal(await page.locator('.origin').count(), 0); assert.equal(await page.locator('#remember').isChecked(), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), LEGACY_KEY), v1Bytes);
    await reveal(page, 'B'); await page.check('#remember'); await saved(page);
    const v2Bytes = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    assert.equal(JSON.parse(v2Bytes).version, 2); assert.deepEqual(JSON.parse(v2Bytes).ratings, { A: {}, B: {} });
    const oldLoaded = await old.evaluate(async () => (await import('./storage.js')).loadLocal().session);
    assert.equal(oldLoaded.version, 1);
    await old.evaluate(async () => { const s = await import('./storage.js'); const current = s.loadLocal().session; current.question = 'Old tab updated its own v1 copy.'; s.saveLocal(current); s.clearLocal(); });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), v2Bytes);
    assert.equal(await page.locator('#data-status').getAttribute('data-state'), 'saved');
    assert.equal(await page.locator('.origin').count(), 2);
  } finally { await context.close(); }
});

test('unknown future saved data is preserved on load, demo and reset instead of erased', async () => {
  const { context, page } = await fixture();
  const future = '{"version":9,"payload":"Synthetic future-format sentinel"}';
  try {
    await page.evaluate(({ key, future }) => localStorage.setItem(key, future), { key: STORAGE_KEY, future });
    await page.reload(); await page.waitForSelector('#demo-button');
    assert.equal(await page.locator('#data-status').getAttribute('data-state'), 'protected');
    assert.equal(await page.locator('#remember').isDisabled(), true);
    await demo(page); await reveal(page); await reset(page);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), future);
    assert.equal(await page.locator('#data-status').getAttribute('data-state'), 'protected');
  } finally { await context.close(); }
});

test('actual v1 and v2 partial-rating files import as revealed, with saving off', async () => {
  const { context, page } = await fixture();
  try {
    await page.setInputFiles('#import-file', { name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(legacyJSON()) });
    await page.waitForSelector('#copy-note'); assert.match(await page.locator('.reveal-summary').innerText(), /already revealed/i);
    assert.equal(await page.locator('#remember').isChecked(), false); assert.equal(await page.locator('.origin').count(), 2);
    await reset(page);
    let s = beginBlind(demoSession(), { seed: 42, now: '2026-09-21T07:00:00.000Z' }); s = setRating(s, 'B', 'factualConfidence', 'unsure');
    s = lockAndReveal(s, 'neither', 'Synthetic partial import.', '2026-09-21T07:01:00.000Z');
    await page.setInputFiles('#import-file', { name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(exportResult(s)) });
    await page.waitForSelector('#copy-note');
    assert.deepEqual(await page.locator('[data-label="B"] dd').allTextContents(), ['Not rated', 'Not rated', 'Not sure']);
    assert.equal(await page.locator('#remember').isChecked(), false); assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
  } finally { await context.close(); }
});

test('malicious-looking pasted text remains inert in full answers, notes, origins and copy fallback', async () => {
  const { context, page } = await fixture({ init: denyCopy });
  try {
    const payload = '</textarea><img src="https://invalid.example/x" onerror="globalThis.PWNED=1"><script>bad()</script>';
    for (const id of ['question', 'answer-0', 'answer-1', 'origin-0', 'origin-1']) await page.fill(`#${id}`, payload);
    await page.click('#begin-button'); await page.fill('#note', payload); await reveal(page, 'A'); await page.click('#copy-note');
    await page.waitForSelector('#copy-fallback:not([hidden])');
    assert.ok((await page.inputValue('#copy-text')).includes(payload));
    assert.equal(await page.locator('#app img,#app script,#app iframe').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.PWNED), undefined);
    await page.click('#copy-answer'); await page.waitForFunction(payload => document.querySelector('#copy-text').value === payload, payload);
  } finally { await context.close(); }
});

test('late clipboard rejection after reset cannot resurrect a previous result', async () => {
  const { context, page } = await fixture({ init: () => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise((resolve, reject) => { globalThis.rejectCopy = reject; }) } }) });
  try {
    await demo(page); await reveal(page); await page.click('#copy-note'); await reset(page);
    await page.evaluate(() => globalThis.rejectCopy(new DOMException('Denied later', 'NotAllowedError')));
    assert.equal(await page.locator('#copy-fallback').count(), 0); assert.equal(await page.inputValue('#question'), '');
  } finally { await context.close(); }
});

test('an unsaved comparison requests an actual beforeunload warning in this Chrome environment', async () => {
  const { context, page } = await fixture();
  try {
    await demo(page); page.removeAllListeners('dialog');
    let type = null;
    page.once('dialog', async dialog => { type = dialog.type(); await dialog.dismiss(); });
    await page.reload({ timeout: 3000 }).catch(() => {});
    assert.equal(type, 'beforeunload'); assert.equal(await page.locator('#verdict-form').count(), 1);
  } finally { await context.close(); }
});

test('reset cancels a save waiting for another tab lock and does not erase a newly typed draft', async () => {
  const { context, page } = await fixture();
  try {
    const blocker = await context.newPage(); await blocker.goto(base);
    await blocker.evaluate(() => {
      navigator.locks.request('answer-lens-device-v2', () => new Promise(resolve => { globalThis.releaseTestLock = resolve; globalThis.testLockHeld = true; }));
    });
    await blocker.waitForFunction(() => globalThis.testLockHeld === true);
    await demo(page); await page.check('#remember');
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saving');
    await reset(page); await page.fill('#question', 'New draft while the old save is being cancelled.');
    await blocker.evaluate(() => globalThis.releaseTestLock());
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'tab');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    assert.equal(await page.inputValue('#question'), 'New draft while the old save is being cancelled.');
    assert.equal(await page.inputValue('#answer-0'), '');
  } finally { await context.close(); }
});

test('a delayed local import cannot bring old data back after reset', async () => {
  const { context, page } = await fixture({ init: () => {
    const original = File.prototype.text;
    File.prototype.text = function() {
      if (this.name === 'delayed.json') return new Promise(resolve => { globalThis.finishDelayedImport = resolve; });
      return original.call(this);
    };
  } });
  try {
    await page.setInputFiles('#import-file', { name: 'delayed.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await page.waitForFunction(() => typeof globalThis.finishDelayedImport === 'function');
    await reset(page); await page.fill('#question', 'New draft after cancelling the old view.');
    await page.evaluate(json => globalThis.finishDelayedImport(json), legacyJSON());
    assert.equal(await page.locator('#copy-note').count(), 0);
    assert.equal(await page.inputValue('#question'), 'New draft after cancelling the old view.');
    assert.equal(await page.locator('#reset-dialog').isVisible(), false);
  } finally { await context.close(); }
});

test('evolution journeys emitted no app exceptions, external requests or outgoing data requests', () => {
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []); assert.deepEqual(nonGetRequests, []);
});
