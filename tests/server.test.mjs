import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createAppServer } from '../scripts/serve.mjs';
import { createPrototypeServer, PREVIEW_PATH } from '../scripts/serve-prototype.mjs';
let server, base, preview, previewBase;
before(async () => {
  server = createAppServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  preview = createPrototypeServer(); preview.listen(0, '127.0.0.1'); await once(preview, 'listening'); previewBase = `http://127.0.0.1:${preview.address().port}`;
});
after(async () => {
  for (const service of [server, preview]) if (service) { service.closeAllConnections(); await new Promise(resolve => service.close(resolve)); }
});
test('serves the complete app shell over loopback with safe headers', async () => {
  for (const path of ['/', '/index.html', '/styles.css', '/icon.svg', '/sw.js', '/src/app.js', '/src/core.js', '/src/storage.js', '/src/demo.js', '/src/output.js']) {
    const response = await fetch(base + path); assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
});
test('preview serves its complete isolated shell and root app without opening repository access', async () => {
  const entries = ['index.html', 'comparison.html', 'mobile.html', 'styles.css', 'icon.svg', 'sw.js',
    'src/app.js', 'src/core.js', 'src/storage.js', 'src/demo.js', 'src/output.js', 'prancheta.json', 'resources.json'];
  for (const path of entries) {
    const response = await fetch(previewBase + PREVIEW_PATH + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-security-policy'), /form-action 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    const bytes = await readFile(new URL(`..${PREVIEW_PATH}${path}`, import.meta.url));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes, path);
    assert.equal(Number(response.headers.get('content-length')), bytes.length);
    if (path.endsWith('.js')) assert.match(response.headers.get('content-type'), /javascript/);
    if (path.endsWith('.json')) assert.equal(response.headers.get('content-type'), 'application/json');
  }
  assert.match(await (await fetch(previewBase + PREVIEW_PATH)).text(), /Isolated preview/);
  assert.match(await (await fetch(previewBase + '/')).text(), /Answer Lens/);
  for (const path of ['.git/config', 'README.md', 'tests/core.test.mjs', 'captures/round3-desktop-result.png', '../answer-lens-evolution/DESIGN.md']) {
    assert.equal((await fetch(previewBase + PREVIEW_PATH + path)).status, 404, path);
  }
  assert.equal((await fetch(previewBase + '/package.json')).status, 404);
});
test('preview HEAD responses preserve byte lengths and non-read methods never accept data', async () => {
  for (const path of ['comparison.html', 'src/output.js', 'resources.json']) {
    const response = await fetch(previewBase + PREVIEW_PATH + path, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.ok(Number(response.headers.get('content-length')) > 0);
    assert.equal(await response.text(), '');
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const response = await fetch(previewBase + PREVIEW_PATH + 'comparison.html', { method, body: 'Synthetic test data' });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  }
});
test('does not expose repository metadata, project files, or arbitrary paths', async () => {
  for (const path of ['/.git/config', '/package.json', '/tests/core.test.mjs', '/docs/evidence.md', '/etc/passwd', '/%2e%2e/%2e%2e/etc/passwd']) assert.equal((await fetch(base + path)).status, 404, path);
});
test('does not accept answer uploads or any non-read method', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await fetch(base, { method, body: 'private-answer' })).status, 405);
  const response = await fetch(base, { method: 'HEAD' }); assert.equal(response.status, 200); assert.equal(await response.text(), '');
});
test('HTML and CSS have no remote runtime resource references', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /(?:src|href)=["'](?:https?:)?\/\//i);
  assert.doesNotMatch(css, /@import|url\(\s*["']?https?:/i);
  assert.match(html, /<html lang="en">/); assert.match(html, /name="viewport"/);
});
test('service worker handles only its explicit local app-shell list', async () => {
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(worker, /URLS\.has\(url\.href\)/); assert.match(worker, /event\.request\.method !== 'GET'/);
  assert.doesNotMatch(worker, /localStorage|STORAGE_KEY|\.json['"]/);
  assert.match(worker, /key\.startsWith\(PREFIX\)/);
});
