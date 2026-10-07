// Real engine journeys; deliberately separate from dependency-free Node gates.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { createAppServer, ROOT } from '../scripts/serve.mjs';
import { importResult } from '../src/core.js';
import { preferredAnswer } from '../src/output.js';
import { STORAGE_KEY } from '../src/storage.js';

const engine = process.env.BROWSER_ENGINE || 'chromium';
const engines = { chromium, firefox, webkit };
if (!Object.hasOwn(engines, engine)) throw new Error('BROWSER_ENGINE must be chromium, firefox or webkit.');
const output = join(ROOT, 'evidence/portability', engine);
const errors = [], outgoing = [], external = [], captures = [], capabilities = [];
let browser, server, base;
before(async () => {
  await mkdir(output, { recursive: true });
  server = createAppServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await engines[engine].launch({ headless: true,
    ...(engine === 'chromium' && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
});
after(async () => {
  await writeFile(join(output, 'receipt.json'), JSON.stringify({ engine, browser: browser?.version(), node: process.version,
    capturedAt: new Date().toISOString(), offlineMethod: 'Origin server stopped; fresh no-worker navigation must fail before controlled reload', capabilities, captures, pageErrors: errors, externalRequests: external,
    outgoingMethods: outgoing, limits: 'Linux engine/viewport coverage; not a physical device, Safari app, Windows or screen-reader certification.' }, null, 2) + '\n');
  await browser?.close();
  if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
async function fixture(viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { async writeText() { throw new DOMException('Synthetic clipboard denial', 'NotAllowedError'); } }
  }));
  context.on('request', request => {
    if (!request.url().startsWith('blob:') && new URL(request.url()).origin !== base) external.push(request.url());
    if (request.method() !== 'GET') outgoing.push(request.method());
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const page = await context.newPage(); page.on('dialog', dialog => dialog.accept());
  await page.goto(base); await page.waitForSelector('#demo-button');
  return { context, page };
}
const choose = (page, verdict) => page.locator(`label:has(input[name="verdict"][value="${verdict}"])`).click();
async function downloadJSON(page) {
  const pending = page.waitForEvent('download'); await page.click('#export-button');
  const download = await pending; const stream = await download.createReadStream(); const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(await download.failure(), null);
  return Buffer.concat(chunks);
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 320, height: 844 }]) {
  test(`${engine} ${viewport.width}px: blind verdict, denied copy, real export/import and question-only continuation`, { timeout: 30000 }, async () => {
    const { context, page } = await fixture(viewport);
    try {
      await page.click('#demo-button');
      const origins = await page.locator('[id^="origin-"]').evaluateAll(nodes => nodes.map(node => node.value));
      const question = await page.inputValue('#question');
      await page.click('#begin-button'); await page.waitForSelector('#verdict-form');
      for (const origin of origins) {
        assert.ok(!(await page.content()).includes(origin));
        assert.ok(!(await page.locator('body').ariaSnapshot()).includes(origin));
      }
      await page.click('#reveal-button'); await page.waitForSelector('#verdict-error:not([hidden])');
      assert.equal(await page.evaluate(() => document.activeElement.name), 'verdict');
      const note = 'Synthetic engine check: </textarea><img src=x onerror=alert(1)> stays text.';
      await page.fill('#note', note); await choose(page, 'B'); await page.click('#reveal-button'); await page.waitForSelector('#copy-note');
      assert.equal(await page.locator('#app img,#app script').count(), 0);
      assert.equal(await page.locator('.origin').count(), 2);
      await page.click('#copy-note'); await page.waitForSelector('#copy-fallback:not([hidden])');
      assert.ok((await page.inputValue('#copy-text')).includes(note));
      const bytes = await downloadJSON(page); const result = importResult(bytes.toString());
      assert.equal(result.verdict, 'B'); assert.deepEqual(result.ratings, { A: {}, B: {} });
      await page.click('#copy-answer');
      await page.waitForFunction(text => document.querySelector('#copy-text').value === text, preferredAnswer(result));
      await page.click('#next-pair'); await page.click('#cancel-reset');
      assert.equal(await page.locator('#copy-note').count(), 1);
      await page.click('#next-pair'); await page.click('#confirm-reset'); await page.waitForSelector('#question');
      assert.equal(await page.inputValue('#question'), question);
      for (const id of ['answer-0', 'answer-1', 'origin-0', 'origin-1']) assert.equal(await page.inputValue(`#${id}`), '');
      assert.equal(await page.locator('#remember').isChecked(), false);
      await page.setInputFiles('#import-file', { name: 'synthetic-engine-result.json', mimeType: 'application/json', buffer: bytes });
      await page.waitForSelector('#reset-dialog[open]'); await page.click('#confirm-reset'); await page.waitForSelector('#copy-note');
      assert.match(await page.locator('.reveal-summary').innerText(), /already revealed/i);
      assert.equal(await page.locator('#remember').isChecked(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.evaluate(() => window.scrollTo(0, 0));
      const path = join(output, `result-${viewport.width}.png`); await page.screenshot({ path, fullPage: true });
      captures.push({ path: `result-${viewport.width}.png`, viewport, scenario: 'Locally re-imported, locked synthetic result; saving off.' });
    } finally { await context.close(); }
  });
}

test(`${engine}: device-saving consent and an actual offline reload follow browser capabilities`, { timeout: 30000 }, async () => {
  const { context, page } = await fixture({ width: 390, height: 844 });
  try {
    const support = await page.evaluate(() => ({ locks: !!navigator.locks?.request, worker: 'serviceWorker' in navigator, secure: isSecureContext }));
    capabilities.push(support); assert.equal(support.secure, true);
    await page.click('#demo-button'); await page.check('#remember');
    await page.waitForFunction(() => ['saved', 'failed'].includes(document.querySelector('#data-status').dataset.state));
    assert.equal(await page.locator('#data-status').getAttribute('data-state'), support.locks ? 'saved' : 'failed');
    const raw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    assert.equal(raw === null, !support.locks);
    await page.click('#begin-button'); await choose(page, 'A'); await page.click('#reveal-button'); await page.waitForSelector('#copy-note');
    if (support.locks) await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved');
    const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    if (support.worker) {
      await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated' && document.querySelector('#offline-status').textContent.includes('Offline app ready'));
      // Stop the real loopback origin: WebKit 1.63's offline emulation rejects even literal SW responses
      // (microsoft/playwright#42775). No routes, mocks or weakened offline assertions.
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      const control = await browser.newContext({ serviceWorkers: 'block' });
      try {
        const fresh = await control.newPage();
        await assert.rejects(fresh.goto(base, { timeout: 5000 }));
      } finally { await control.close(); }
      await page.reload();
      await page.waitForSelector(support.locks ? '#copy-note' : '#demo-button');
      if (support.locks) assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), saved);
      else assert.equal(await page.inputValue('#question'), '');
      await page.waitForFunction(() => document.querySelector('#offline-status').textContent.includes('Offline app ready'));
    } else assert.match(await page.locator('#offline-status').innerText(), /unsupported/);
  } finally { await context.close(); }
});

test(`${engine}: journeys sent no data, requested no third party and raised no app exceptions`, () => {
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(outgoing, []);
});
