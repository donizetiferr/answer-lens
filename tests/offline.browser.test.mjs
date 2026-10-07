import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { SHELL_FILES, stampShell } from '../scripts/sync-offline.mjs';
import { CSP } from '../scripts/serve.mjs';
import { STORAGE_KEY } from '../src/storage.js';

let server, browser, base, served, rejected = null;
const errors = [];
const mime = path => path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript';
const original = new Map(await Promise.all(SHELL_FILES.map(async path => [path, await readFile(new URL(`../${path}`, import.meta.url), 'utf8')])));
function generation(name) {
  const files = new Map(original);
  files.set('index.html', files.get('index.html').replace('Two answers. One thoughtful decision.', `Offline upgrade ${name}.`));
  files.set('styles.css', files.get('styles.css') + `\n/* Upgrade generation ${name} */\n`);
  files.set('sw.js', stampShell(files).worker);
  return files;
}
before(async () => {
  server = http.createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
    const body = served?.get(path);
    response.writeHead(path === rejected ? 503 : body === undefined ? 404 : 200,
      { 'Content-Type': mime(path), 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP });
    response.end(path === rejected ? 'Unavailable during synthetic upgrade' : body ?? 'Not found');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
});
after(async () => {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('real worker upgrades shell bytes without reloading a draft, then reopens saved results offline', { timeout: 30000 }, async () => {
  served = generation('before');
  const context = await browser.newContext();
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto(base); await page.waitForSelector('#demo-button');
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.click('#demo-button'); await page.check('#remember');
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved');
    await page.fill('#question', 'Synthetic draft kept through an offline shell update.');
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved');
    await page.locator('#question').evaluate(node => node.setSelectionRange(2, 9));
    const draft = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    const oldCache = (await page.evaluate(() => caches.keys())).find(key => key.startsWith('answer-lens-shell:'));
    await page.evaluate(() => caches.open('another-app-cache'));
    served = generation('after');
    await page.evaluate(async () => {
      globalThis.shellChanged = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { globalThis.shellChanged = true; }, { once: true });
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await page.waitForFunction(() => globalThis.shellChanged);
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
    assert.equal(await page.inputValue('#question'), JSON.parse(draft).question);
    assert.deepEqual(await page.locator('#question').evaluate(node => [node === document.activeElement, node.selectionStart, node.selectionEnd]), [true, 2, 9]);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), draft);
    assert.match(await page.locator('.site-footer').innerText(), /upgrade before/); // No forced reload.
    const installedCaches = await page.evaluate(() => caches.keys());
    assert.ok(!installedCaches.includes(oldCache), JSON.stringify({ oldCache, installedCaches }));
    assert.ok((await page.evaluate(() => caches.keys())).includes('another-app-cache'));
    await page.click('#begin-button'); await page.locator('label:has(input[name="verdict"][value="B"])').click(); await page.click('#reveal-button');
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved');
    const result = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    await context.setOffline(true); await page.reload(); await page.waitForSelector('#copy-note');
    assert.match(await page.locator('.site-footer').innerText(), /upgrade after/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), result);
    assert.equal(await page.locator('.origin').count(), 2);
    await mkdir(new URL('../evidence/offline-upgrade/', import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL('../evidence/offline-upgrade/result.png', import.meta.url).pathname, fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a failed new-shell download leaves the old offline application and saved work usable', { timeout: 30000 }, async () => {
  served = generation('stable'); rejected = null;
  const context = await browser.newContext(); const page = await context.newPage(); page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto(base); await page.waitForSelector('#question'); await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.fill('#question', 'Synthetic saved draft before failed update.'); await page.check('#remember');
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'saved');
    const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    const stable = (await page.evaluate(() => caches.keys())).find(key => key.startsWith('answer-lens-shell:'));
    served = generation('broken'); rejected = 'src/output.js';
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const failed = new Promise(resolve => registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(); });
      }, { once: true }));
      await registration.update(); await failed;
    });
    assert.ok((await page.evaluate(() => caches.keys())).includes(stable));
    await context.setOffline(true); await page.reload(); await page.waitForSelector('#question');
    assert.match(await page.locator('.site-footer').innerText(), /upgrade stable/);
    assert.equal(await page.inputValue('#question'), JSON.parse(saved).question);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), saved);
  } finally { rejected = null; await context.close(); }
});
