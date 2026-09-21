import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { chromium } from 'playwright';
import { createPrototypeServer, PREVIEW_PATH } from '../scripts/serve-prototype.mjs';
import { ROOT, COLLECTION, PREVIEW, syncPrototype } from '../scripts/sync-prototype.mjs';
import { STORAGE_KEY, LEGACY_KEY, LOCK_NAME } from '../src/storage.js';
import { beginBlind, importResult, exportResult } from '../src/core.js';
import { demoSession } from '../src/demo.js';
import { legacySession } from './fixtures/sessions.mjs';
let browser, server, base;
const captures = [], errors = [], external = [], nonGet = [], contexts = new Set();
// Refresh committed catalog pictures only with an explicit review-capture override.
const OUT = join(ROOT, process.env.ANSWER_LENS_PROTOTYPE_CAPTURE_DIR || 'evidence/prototype-captures');
before(async () => {
  await syncPrototype(); await mkdir(OUT, { recursive: true });
  await mkdir(join(ROOT, 'evidence/round3'), { recursive: true });
  server = createPrototypeServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
});
after(async () => {
  for (const context of contexts) await context.close();
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await writeFile(join(ROOT, 'evidence/round3/prototype-browser.local.json'), JSON.stringify({
    observedAt: new Date().toISOString(), browser: browser?.version(), node: process.version,
    rootAndPreviewSameOrigin: true, captures, pageErrors: errors, externalRequests: external, nonGetRequests: nonGet,
    serverClosed: !server?.listening, scope: 'Actual headless Chrome; synthetic fixtures and isolated contexts. No screen-reader certification. Visual inspection is separately recorded.'
  }, null, 2) + '\n');
});
async function fixture(viewport = { width: 1440, height: 1000 }, deny = false) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', permissions: deny ? [] : ['clipboard-read', 'clipboard-write'] }); contexts.add(context);
  await context.addInitScript(({ prefix, deny }) => {
    globalThis.__storageAccess = [];
    for (const name of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[name];
      Storage.prototype[name] = function(key, ...args) { globalThis.__storageAccess.push({ method: name, key }); return original.call(this, key, ...args); };
    }
    if (deny && location.pathname.startsWith(prefix)) Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText() { throw new DOMException('Test denial', 'NotAllowedError'); } } });
  }, { prefix: PREVIEW_PATH, deny });
  context.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('blob:')) external.push(request.url()); if (request.method() !== 'GET') nonGet.push(request.method()); });
  context.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); });
  const rootPage = await context.newPage(); await rootPage.goto(base);
  // Establish an actually cached root application before preparing/reloading its saved fixture.
  // Do not interrupt the very first service-worker installation with the fixture reload.
  await rootPage.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#offline-status').textContent.includes('Offline app ready'), null, { polling: 100 });
  const rootState = beginBlind(demoSession(true), { seed: 29, now: '2026-09-21T07:00:00.000Z' }); rootState.question = 'Main-app synthetic comparison: must not be opened in the catalog.';
  const rootLegacy = { ...legacySession('blind'), remember: true };
  await rootPage.evaluate(({ current, old, key, legacyKey }) => { localStorage.setItem(key, JSON.stringify(current)); localStorage.setItem(legacyKey, JSON.stringify(old)); }, { current: rootState, old: rootLegacy, key: STORAGE_KEY, legacyKey: LEGACY_KEY });
  await rootPage.reload(); await rootPage.waitForSelector('#verdict-form');
  const snapshot = await rootBytes(rootPage);
  const page = await context.newPage();
  return { context, rootPage, page, snapshot };
}
async function dispose(context) { contexts.delete(context); await context.close(); }
const rootBytes = page => page.evaluate(({ key, old }) => [localStorage.getItem(key), localStorage.getItem(old)], { key: STORAGE_KEY, old: LEGACY_KEY });
const choose = (page, name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).click();
const saved = page => page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved');
const reset = async page => { await page.click('#reset-button'); await page.click('#confirm-reset'); await page.waitForSelector('#question'); await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'tab'); };
async function capture(page, name, scenario, fullPage = false) {
  const file = `round3-${name}.png`; const path = join(OUT, file); await page.screenshot({ path, fullPage });
  captures.push({ path: relative(ROOT, path).split(sep).join('/'), sha256: createHash('sha256').update(await readFile(path)).digest('hex'), viewport: page.viewportSize(), scenario, fullPage });
}
async function downloadJSON(page) {
  const pending = page.waitForEvent('download'); await page.click('#export-button'); const download = await pending;
  assert.equal(await download.failure(), null); const stream = await download.createReadStream(); const chunks = [];
  for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks);
}
for (const [name, entry, viewport] of [['desktop', 'comparison.html', { width: 1440, height: 1000 }], ['mobile', 'mobile.html', { width: 390, height: 844 }]]) {
  test(`current ${name} prototype: read, decide, copy, export/import and next pair; real app untouched`, async () => {
    const { context, rootPage, page, snapshot } = await fixture(viewport, true);
    try {
      await page.goto(base + PREVIEW_PATH + entry); await page.waitForSelector('#demo-button');
      assert.match(await page.locator('[aria-label="Isolated catalog preview"]').innerText(), /separate demo storage/);
      assert.equal(await page.inputValue('#question'), ''); assert.equal(await page.locator('#legacy-button').count(), 0);
      await page.click('#demo-button'); const question = await page.inputValue('#question');
      const origins = await page.locator('[id^="origin-"]').evaluateAll(nodes => nodes.map(node => node.value));
      await page.click('#begin-button');
      assert.equal(await page.locator('#details-ratings').evaluate(node => node.open), false);
      for (const origin of origins) assert.ok(!(await page.locator('body').ariaSnapshot()).includes(origin));
      await page.check('#remember'); await saved(page);
      await page.locator('.reader-nav a[href="#answer-B"]').click(); assert.equal(await page.evaluate(() => document.activeElement.id), 'answer-B');
      await capture(page, `${name}-reading`, 'Current v2 preview: full synthetic answers, isolated save and A/B/decision navigation.');
      await page.locator('.reader-nav a[href="#decision-title"]').click(); await page.click('#reveal-button');
      assert.equal(await page.evaluate(() => document.activeElement.name), 'verdict'); assert.equal(await page.locator('.origin').count(), 0);
      if (name === 'mobile') {
        await page.locator('#details-ratings > summary').click(); await choose(page, 'B-factualConfidence', 'unsure');
        await page.locator('#details-ratings > summary').click();
      }
      await page.fill('#note', 'Synthetic review example: I prefer the wording of Answer A.'); await choose(page, 'verdict', 'A'); await page.click('#reveal-button'); await page.waitForSelector('#copy-note'); await saved(page);
      assert.equal(await page.locator('.origin').count(), 2); assert.equal(await page.locator('input[name="verdict"]').count(), 0);
      await capture(page, `${name}-result`, 'Current v2 preview: locked verdict, copy actions, optional ratings and safe repeat-question action.', true);
      await page.click('#copy-note'); await page.waitForSelector('#copy-text');
      const note = await page.inputValue('#copy-text'); assert.match(note, /SYNTHETIC DEMO/); assert.match(note, /You preferred Answer A/); assert.match(note, /Not rated/);
      await page.click('#select-copy-text'); assert.equal(await page.locator('#copy-text').evaluate(node => node.selectionEnd - node.selectionStart), note.length);
      if (name === 'desktop') await capture(page, 'copy-fallback', 'Clipboard denial produces selectable plain text, not an inert button.');
      await page.click('#copy-answer'); assert.match(await page.inputValue('#copy-text'), /^SYNTHETIC EXAMPLE/);
      const exported = await downloadJSON(page); const completed = importResult(exported.toString()); assert.equal(completed.synthetic, true); assert.equal(completed.verdict, 'A');
      await page.click('#next-pair'); await page.click('#cancel-reset'); assert.equal(await page.locator('#copy-note').count(), 1);
      await page.click('#next-pair'); await page.click('#confirm-reset'); await page.waitForSelector('#question');
      assert.equal(await page.inputValue('#question'), question);
      for (const id of ['answer-0', 'answer-1', 'origin-0', 'origin-1']) assert.equal(await page.inputValue(`#${id}`), '');
      assert.equal(await page.locator('#remember').isChecked(), false); assert.equal(await page.locator('.demo-notice').count(), 0);
      await page.setInputFiles('#import-file', { name: 'preview-result.json', mimeType: 'application/json', buffer: exported });
      await page.waitForSelector('#reset-dialog[open]'); await page.click('#confirm-reset'); await page.waitForSelector('#copy-note');
      assert.match(await page.locator('.reveal-summary').innerText(), /already revealed/i); assert.equal(await page.locator('#remember').isChecked(), false);
      const roundtrip = await downloadJSON(page); assert.equal(exportResult(importResult(roundtrip.toString())), exportResult(completed));
      await reset(page);
      assert.deepEqual(await rootBytes(rootPage), snapshot);
      assert.equal(await rootPage.locator('#data-status').getAttribute('data-state'), 'saved');
      assert.equal(await rootPage.locator('.origin').count(), 0);
      const operations = await page.evaluate(() => globalThis.__storageAccess);
      assert.ok(operations.length > 0); assert.ok(operations.every(({ key }) => key === PREVIEW.storageKey || key === PREVIEW.legacyKey), 'Preview must not even read real-app storage');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally { await dispose(context); }
  });
}

test('preview-only legacy migration and lock namespace remain isolated while a real app tab is active', async () => {
  const { context, rootPage, page, snapshot } = await fixture();
  try {
    const old = { ...legacySession('blind'), remember: true };
    await rootPage.evaluate(({ key, old }) => localStorage.setItem(key, JSON.stringify(old)), { key: PREVIEW.legacyKey, old });
    await rootPage.evaluate(lock => { globalThis.rootLockHeld = false; navigator.locks.request(lock, async () => { globalThis.rootLockHeld = true; await new Promise(resolve => { globalThis.releaseRootLock = resolve; }); }); }, LOCK_NAME);
    await rootPage.waitForFunction(() => globalThis.rootLockHeld);
    await page.goto(base + PREVIEW_PATH + 'comparison.html'); await page.click('#legacy-button');
    await page.waitForSelector('#verdict-form'); assert.equal(await page.locator('#remember').isChecked(), false);
    assert.equal(await page.locator('.origin').count(), 0); await page.check('#remember'); await saved(page);
    const previewState = JSON.parse(await page.evaluate(key => localStorage.getItem(key), PREVIEW.storageKey));
    assert.equal(previewState.version, 2); assert.deepEqual(previewState.randomization, old.randomization);
    assert.deepEqual(await rootBytes(rootPage), snapshot);
    await rootPage.evaluate(() => globalThis.releaseRootLock());
    await page.fill('#note', 'Keep preview draft and cursor when root changes.'); await saved(page);
    await page.locator('#note').focus(); await page.locator('#note').evaluate(node => node.setSelectionRange(5, 12));
    await rootPage.fill('#note', 'Independent edit in the real app.'); await saved(rootPage); await page.waitForTimeout(150);
    assert.equal(await page.inputValue('#note'), 'Keep preview draft and cursor when root changes.');
    assert.deepEqual(await page.locator('#note').evaluate(node => [document.activeElement.id, node.selectionStart, node.selectionEnd]), ['note', 5, 12]);
    assert.equal(await page.locator('#data-status').getAttribute('data-state'), 'saved');
    const updatedRoot = await rootBytes(rootPage);
    await reset(page); assert.deepEqual(await rootBytes(rootPage), updatedRoot);
    assert.equal(await rootPage.evaluate(key => localStorage.getItem(key), PREVIEW.legacyKey), JSON.stringify(old));
    const operations = await page.evaluate(() => globalThis.__storageAccess);
    assert.ok(operations.every(({ key }) => [PREVIEW.storageKey, PREVIEW.legacyKey].includes(key)));
  } finally { await rootPage.evaluate(() => globalThis.releaseRootLock?.()).catch(() => {}); await dispose(context); }
});

test('real clipboard copies preview decision and preferred answer without involving real app state', async () => {
  const { context, rootPage, page, snapshot } = await fixture();
  try {
    await page.goto(base + PREVIEW_PATH + 'index.html'); await page.click('#demo-button'); await page.click('#begin-button');
    await choose(page, 'verdict', 'B'); await page.click('#reveal-button'); await page.waitForSelector('#copy-note');
    await page.click('#copy-note'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Decision note copied'));
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /SYNTHETIC DEMO/);
    const expected = await page.locator('[data-label="B"] .answer-text').innerText();
    await page.click('#copy-answer'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Preferred answer copied'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'SYNTHETIC EXAMPLE — not a measured model output.\n\n' + expected);
    await page.evaluate(() => navigator.clipboard.writeText(''));
    assert.deepEqual(await rootBytes(rootPage), snapshot);
  } finally { await dispose(context); }
});

test('each navigable alias works offline and preview workers/caches never take over root app assets', async () => {
  const { context, rootPage, page, snapshot } = await fixture();
  try {
    // Poll background-tab worker state independently of paint.
    await rootPage.waitForFunction(() => navigator.serviceWorker.controller, null, { polling: 100 });
    await page.goto(base + PREVIEW_PATH + 'comparison.html');
    await page.waitForFunction(prefix => navigator.serviceWorker.controller?.scriptURL.includes(prefix + 'sw.js'), PREVIEW_PATH);
    await page.click('#demo-button'); await page.check('#remember'); await page.click('#begin-button'); await saved(page);
    const previewRaw = await page.evaluate(key => localStorage.getItem(key), PREVIEW.storageKey);
    const cacheKeys = await page.evaluate(() => caches.keys());
    assert.ok(cacheKeys.some(key => key.startsWith('answer-lens-shell:/')));
    const previewKey = cacheKeys.find(key => key.startsWith('answer-lens-preview-shell:'));
    assert.ok(previewKey);
    const cachedURLs = await page.evaluate(async key => (await (await caches.open(key)).keys()).map(request => request.url), previewKey);
    assert.ok(cachedURLs.every(url => url.startsWith(base + PREVIEW_PATH)));
    for (const entry of ['index.html', 'comparison.html', 'mobile.html']) assert.ok(cachedURLs.includes(base + PREVIEW_PATH + entry));
    await context.setOffline(true);
    for (const entry of ['comparison.html', 'mobile.html', 'index.html']) {
      await page.goto(base + PREVIEW_PATH + entry, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#verdict-form');
      assert.equal(await page.locator('.origin').count(), 0);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), PREVIEW.storageKey), previewRaw);
    }
    await rootPage.reload({ waitUntil: 'domcontentloaded' }); await rootPage.waitForSelector('#verdict-form');
    assert.deepEqual(await rootBytes(rootPage), snapshot);
    assert.ok(!(await rootPage.evaluate(() => navigator.serviceWorker.controller.scriptURL)).includes(PREVIEW_PATH));
    await reset(page); assert.deepEqual(await rootBytes(rootPage), snapshot);
    assert.ok((await page.evaluate(() => caches.keys())).includes(cacheKeys.find(key => key.startsWith('answer-lens-shell:/'))));
  } finally { await context.setOffline(false); await dispose(context); }
});

test('review server exposes only local app/preview assets and rejects upload or repository-file access', async () => {
  for (const path of [PREVIEW_PATH + '.git/config', PREVIEW_PATH + 'captures/unknown.png', '/README.md', '/tests/prototype.test.mjs']) {
    const response = await fetch(base + path); assert.equal(response.status, 404); await response.arrayBuffer();
  }
  const post = await fetch(base + PREVIEW_PATH + 'comparison.html', { method: 'POST', body: 'synthetic test; not user data' });
  assert.equal(post.status, 405); await post.arrayBuffer();
  const response = await fetch(base + PREVIEW_PATH + 'src/output.js'); assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /form-action 'none'/); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); await response.arrayBuffer();
});

test('prototype journeys produced no app exceptions, external requests or outgoing user-data requests', () => {
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(nonGet, []);
});

test('root and preview favicon assets decode as actual SVG images', async () => {
  const context = await browser.newContext({ viewport: { width: 96, height: 96 } }); contexts.add(context);
  try {
    const page = await context.newPage();
    for (const prefix of ['/', PREVIEW_PATH]) {
      await page.goto(base + prefix + 'icon.svg');
      const decoded = await page.evaluate(() => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
        image.onerror = () => resolve(null);
        image.src = location.href;
      }));
      assert.deepEqual(decoded, [48, 48], 'A favicon must decode, not just return HTTP 200');
    }
    await page.screenshot({ path: join(ROOT, 'evidence/round3/favicon.local.png') });
  } finally { await dispose(context); }
});
