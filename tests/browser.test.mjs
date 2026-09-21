import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createAppServer, ROOT } from '../scripts/serve.mjs';
import { importResult, exportResult } from '../src/core.js';
import { STORAGE_KEY } from '../src/storage.js';
let browser, server, base;
const errors = [], externalRequests = [], dataRequests = [];
// Keep earlier captures intact; this revision writes its own browser evidence.
const media = join(ROOT, process.env.ANSWER_LENS_REGRESSION_MEDIA || 'evidence/evolution-regression-captures');
const evidence = join(ROOT, process.env.ANSWER_LENS_REGRESSION_EVIDENCE || 'evidence/evolution-regression');
before(async () => {
  await mkdir(media, { recursive: true }); await mkdir(evidence, { recursive: true });
  server = createAppServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
});
after(async () => {
  if (browser) await browser.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ...options });
  context.on('request', request => {
    if (!request.url().startsWith(base) && !request.url().startsWith('blob:')) externalRequests.push(request.url());
    if (request.method() !== 'GET') dataRequests.push({ method: request.method(), url: request.url() });
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  return { context, page };
}
async function open(page) { await page.goto(base); await page.waitForSelector('#demo-button'); }
async function demo(page) { await open(page); await page.click('#demo-button'); }
async function choose(page, name, value) { await page.locator(`label:has(input[name="${name}"][value="${value}"])`).click(); }
async function saved(page) { await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved'); }
async function rate(page) {
  if (!await page.locator('#details-ratings').evaluate(node => node.open)) await page.locator('#details-ratings > summary').click();
  for (const label of ['A', 'B']) for (const metric of ['usefulness', 'clarity', 'factualConfidence']) await choose(page, `${label}-${metric}`, metric === 'factualConfidence' ? 'unsure' : label === 'A' ? 4 : 3);
}
async function reveal(page, verdict = 'A') { await rate(page); await choose(page, 'verdict', verdict); await page.click('#reveal-button'); await page.waitForSelector('#export-button'); }
async function reset(page) { await page.click('#reset-button'); await page.click('#confirm-reset'); await page.waitForSelector('#question'); }

test('desktop demo works end to end; sources leak neither into DOM nor accessibility tree before reveal', async () => {
  const { context, page } = await fixture();
  try {
    await demo(page); await page.screenshot({ path: join(media, 'desktop-setup.png'), fullPage: true });
    const origins = await page.locator('input[id^="origin-"]').evaluateAll(nodes => nodes.map(node => node.value));
    await page.click('#begin-button'); await page.waitForSelector('#verdict-form');
    assert.equal(await page.locator('[id^="origin-"]').count(), 0);
    assert.equal(await page.locator('#export-button').count(), 0);
    const markup = await page.content(); const accessibility = await page.locator('body').ariaSnapshot();
    for (const origin of origins) { assert.ok(!markup.includes(origin)); assert.ok(!accessibility.includes(origin)); }
    assert.equal(await page.locator('.origin').count(), 0);
    assert.equal(await page.locator('.hidden-origin').count(), 2);
    await page.screenshot({ path: join(media, 'desktop-blind.png'), fullPage: true });
    await page.click('#reveal-button'); assert.match(await page.locator('#verdict-error').innerText(), /Choose/);
    assert.equal(await page.evaluate(() => document.activeElement.name), 'verdict');
    assert.equal(await page.locator('.origin').count(), 0);
    await rate(page); await page.click('#reveal-button'); assert.match(await page.locator('#verdict-error').innerText(), /Choose/);
    await choose(page, 'verdict', 'A'); await page.fill('#note', 'The steps were easier to act on. I would still check any important claim.');
    await page.click('#reveal-button'); await page.waitForSelector('#export-button');
    assert.equal(await page.locator('.origin').count(), 2);
    for (const origin of origins) assert.ok((await page.locator('body').innerText()).includes(origin));
    assert.equal(await page.locator('input[name="A-usefulness"]').count(), 0);
    await page.screenshot({ path: join(media, 'desktop-result.png'), fullPage: true });
    const downloadPromise = page.waitForEvent('download'); await page.click('#export-button');
    const download = await downloadPromise; const exportPath = join(evidence, 'browser-export.json'); await download.saveAs(exportPath);
    assert.equal(await download.failure(), null);
    const json = await readFile(exportPath, 'utf8'); const saved = importResult(json);
    assert.equal(saved.phase, 'revealed'); assert.equal(saved.verdict, 'A'); assert.equal(saved.synthetic, true);
    assert.equal(exportResult(saved), json);
    await reset(page); await page.setInputFiles('#import-file', exportPath); await page.waitForSelector('#export-button');
    assert.match(await page.locator('.eyebrow').allTextContents().then(items => items.join(' ')), /already revealed/);
    assert.equal(await page.locator('#remember').isChecked(), false);
  } finally { await context.close(); }
});

test('required inputs are validated before source fields disappear', async () => {
  const { context, page } = await fixture();
  try {
    await open(page); await page.click('#begin-button'); assert.match(await page.locator('#error').innerText(), /question.*required/);
    await page.fill('#question', '   '); await page.click('#begin-button'); assert.match(await page.locator('#error').innerText(), /required/);
    await page.fill('#question', 'A real question'); await page.fill('#answer-0', 'First text');
    await page.click('#begin-button'); assert.match(await page.locator('#error').innerText(), /Answer 2.*required/);
    assert.equal(await page.locator('#origin-0').count(), 1);
  } finally { await context.close(); }
});

test('safe text rendering holds in question, answers, sources and note, including after reveal', async () => {
  const { context, page } = await fixture();
  try {
    const payload = '<img src=x onerror="globalThis.PWNED=1">';
    await open(page);
    for (const id of ['question', 'answer-0', 'answer-1', 'origin-0', 'origin-1']) await page.fill(`#${id}`, payload);
    await page.click('#begin-button'); await rate(page); await choose(page, 'verdict', 'neither'); await page.fill('#note', payload); await page.click('#reveal-button');
    assert.equal(await page.locator('#app img,#app script,#app iframe').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.PWNED), undefined);
    assert.equal(await page.locator('.question-text').innerText(), payload);
    assert.equal(await page.locator('.origin').first().innerText(), payload);
    assert.equal(await page.locator('.result-note p').innerText(), payload);
  } finally { await context.close(); }
});

test('local saving is opt-in; reload preserves the blind shuffle; reset clears only app data', async () => {
  const { context, page } = await fixture();
  try {
    await demo(page); assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    await page.reload(); await page.waitForSelector('#question'); assert.equal(await page.inputValue('#question'), '');
    await page.click('#demo-button'); await page.check('#remember'); await page.click('#begin-button'); await page.locator('#details-ratings > summary').click(); await choose(page, 'A-clarity', 4); await saved(page);
    const before = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
    await page.reload(); await page.waitForSelector('#verdict-form');
    const after = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
    assert.deepEqual(after.randomization, before.randomization); assert.equal(after.ratings.A.clarity, 4);
    assert.equal(await page.locator('.origin').count(), 0);
    await page.evaluate(() => { localStorage.setItem('unrelated-app-key', 'keep'); sessionStorage.setItem('unrelated-session', 'keep'); });
    await page.click('#reset-button'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#verdict-form').count(), 1);
    await reset(page);
    assert.equal(await page.inputValue('#question'), ''); assert.equal(await page.inputValue('#answer-0'), ''); assert.equal(await page.inputValue('#answer-1'), '');
    assert.equal(await page.inputValue('#origin-0'), ''); assert.equal(await page.locator('#remember').isChecked(), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('unrelated-app-key'), sessionStorage.getItem('unrelated-session')]), ['keep', 'keep']);
    assert.equal(await page.locator('.answer-card').count(), 0);
  } finally { await context.close(); }
});

test('opting out removes the saved pair while keeping the current tab usable', async () => {
  const { context, page } = await fixture();
  try {
    await demo(page); await page.check('#remember'); await saved(page); assert.ok(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
    await page.uncheck('#remember'); await page.waitForFunction(key => localStorage.getItem(key) === null, STORAGE_KEY); assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    assert.notEqual(await page.inputValue('#question'), '');
  } finally { await context.close(); }
});

test('reset in one opted-in tab preserves another tab and pauses its saving', async () => {
  const { context, page } = await fixture();
  try {
    await demo(page); await page.check('#remember'); await page.click('#begin-button'); await saved(page);
    const other = await context.newPage(); await other.goto(base); await other.waitForSelector('#verdict-form');
    await other.locator('#note').focus();
    await reset(page); await other.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'conflict');
    assert.equal(await other.locator('#verdict-form').count(), 1);
    assert.equal(await other.evaluate(() => document.activeElement.id), 'note');
    assert.equal(await other.locator('#remember').isChecked(), false);
    await other.fill('#note', 'Preserved unsaved work');
    assert.equal(await other.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
  } finally { await context.close(); }
});

test('keyboard users can use the skip link, begin comparison, change ratings and dismiss reset', async () => {
  const { context, page } = await fixture();
  try {
    await open(page); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    await page.locator('#demo-button').focus(); await page.keyboard.press('Space');
    await page.locator('#begin-button').focus(); await page.keyboard.press('Enter'); await page.waitForSelector('#verdict-form');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Answer A');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'answer-A');
    await page.locator('#details-ratings > summary').focus(); await page.keyboard.press('Enter');
    await page.locator('input[name="A-usefulness"][value="1"]').focus();
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('input[name="A-usefulness"][value="2"]').isChecked(), true);
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('input[name="A-usefulness"][value="1"]').isChecked(), true);
    await page.locator('#reset-button').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#reset-dialog').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-reset');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#reset-dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-button');
  } finally { await context.close(); }
});

test('mobile layout supports the full flow at 390px and has no horizontal overflow at 320px', async () => {
  const { context, page } = await fixture({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  try {
    await demo(page); await noOverflow(); await page.screenshot({ path: join(media, 'mobile-setup.png'), fullPage: true });
    await page.click('#begin-button'); await noOverflow();
    await page.screenshot({ path: join(media, 'mobile-blind.png') });
    await page.locator('#details-ratings > summary').click(); await page.locator('.detail-rating-card').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: join(media, 'mobile-ratings.png') });
    for (const box of await page.locator('.rating-option span').evaluateAll(nodes => nodes.map(node => ({ height: node.getBoundingClientRect().height })))) assert.ok(box.height >= 44);
    await page.setViewportSize({ width: 320, height: 760 }); await noOverflow();
    await page.setViewportSize({ width: 390, height: 844 }); await reveal(page, 'tie'); await noOverflow();
    await page.screenshot({ path: join(media, 'mobile-result.png') });
    await reset(page); await page.setViewportSize({ width: 320, height: 760 }); await noOverflow();
  } finally { await context.close(); }
});

test('the saved app works after an actual offline reload and keeps non-app caches', async () => {
  const { context, page } = await fixture();
  try {
    await demo(page); await page.check('#remember'); await page.click('#begin-button');
    await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#offline-status').textContent.includes('Offline app ready'));
    await page.evaluate(() => caches.open('unrelated-offline-cache'));
    await saved(page);
    const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#verdict-form');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), before);
    await reveal(page, 'neither'); assert.match(await page.locator('.reveal-summary').innerText(), /Neither/);
    assert.ok((await page.evaluate(() => caches.keys())).includes('unrelated-offline-cache'));
    await page.screenshot({ path: join(media, 'offline-result.png'), fullPage: true });
    await reset(page); assert.ok((await page.evaluate(() => caches.keys())).includes('unrelated-offline-cache'));
  } finally { await context.setOffline(false); await context.close(); }
});

test('storage-blocked browsers can still compare without an unhandled exception', async () => {
  const { context, page } = await fixture();
  try {
    await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Blocked for this test', 'SecurityError'); } }));
    await demo(page); await page.check('#remember'); await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'failed'); assert.match(await page.locator('#data-status').innerText(), /unavailable/);
    await page.click('#begin-button'); await reveal(page, 'B'); assert.equal(await page.locator('.origin').count(), 2);
    await reset(page); await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'delete-failed'); assert.match(await page.locator('#data-status').innerText(), /blocked deleting saved data/);
  } finally { await context.close(); }
});

test('corrupt saved state and invalid imported files give useful errors without restoring content', async () => {
  const { context, page } = await fixture();
  try {
    await open(page); await page.evaluate(key => localStorage.setItem(key, '{broken'), STORAGE_KEY);
    await page.reload(); await page.waitForSelector('#question');
    assert.match(await page.locator('#data-status').innerText(), /untouched/); assert.equal(await page.inputValue('#question'), '');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), '{broken');
    await page.setInputFiles('#import-file', { name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    assert.match(await page.locator('#error').innerText(), /not an Answer Lens result/);
  } finally { await context.close(); }
});

test('conditional sections never render literal null or undefined in the actual browser', async () => {
  const { context, page } = await fixture();
  const assertNoPlaceholderText = async () => {
    const text = await page.locator('#app').evaluate(node => Array.from(node.childNodes)
      .filter(child => child.nodeType === Node.TEXT_NODE)
      .map(child => child.textContent.trim()).filter(Boolean));
    assert.deepEqual(text, [], 'Conditional sections must be absent, not rendered as text');
    assert.ok(!/\b(null|undefined)\b/.test(await page.locator('#app').ariaSnapshot()));
  };
  try {
    await demo(page); await assertNoPlaceholderText();
    await page.click('#begin-button'); await assertNoPlaceholderText();
    await reveal(page); await assertNoPlaceholderText();
    await reset(page);
    await page.fill('#question', 'How do I organize a folder?');
    await page.fill('#answer-0', 'Create a folder for each project.');
    await page.fill('#answer-1', 'Sort by date, then review older files.');
    await page.click('#begin-button'); await assertNoPlaceholderText();
    await reveal(page, 'tie'); await assertNoPlaceholderText();
    await reset(page); await assertNoPlaceholderText();
  } finally { await context.close(); }
});

test('browser run had no app exceptions, third-party requests or outgoing user-data requests', async () => {
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []); assert.deepEqual(dataRequests, []);
  await writeFile(join(evidence, 'browser-observations.json'), JSON.stringify({
    observedAt: new Date().toISOString(), browserVersion: browser.version(), nodeVersion: process.version,
    desktopViewport: { width: 1440, height: 1000 }, mobileViewport: { width: 390, height: 844 }, narrowWidthChecked: 320,
    pageErrors: errors, externalRequests, nonGetRequests: dataRequests,
    demoRatingsOrigin: 'Automated browser test inputs; not a human study or evidence about model quality.',
    scope: 'Real headless Chrome with isolated temporary contexts and a loopback-only server; not cross-browser or full assistive-technology certification.'
  }, null, 2) + '\n');
});
