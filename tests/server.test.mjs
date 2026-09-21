import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createAppServer } from '../scripts/serve.mjs';
let server, base;
before(async () => { server = createAppServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('serves the complete app shell over loopback with safe headers', async () => {
  for (const path of ['/', '/index.html', '/styles.css', '/icon.svg', '/sw.js', '/src/app.js', '/src/core.js', '/src/storage.js', '/src/demo.js']) {
    const response = await fetch(base + path); assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
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
