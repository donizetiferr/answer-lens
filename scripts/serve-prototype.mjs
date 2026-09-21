// Review-only loopback server: root app plus an explicit catalog-file allowlist.
// This is not a deployment server; it accepts no uploads and cannot serve arbitrary files.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createAppServer, ROOT, CSP } from './serve.mjs';
import { COLLECTION } from './sync-prototype.mjs';
export const PREVIEW_PATH = `/${COLLECTION}/`;
const FILES = new Set(['index.html', 'comparison.html', 'mobile.html', 'styles.css', 'icon.svg', 'sw.js', 'src/app.js', 'src/core.js', 'src/storage.js', 'src/demo.js', 'src/output.js', 'prancheta.json', 'resources.json']);
const mime = path => path.endsWith('.html') ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
export function createPrototypeServer() {
  const server = createAppServer();
  const [rootHandler] = server.listeners('request'); server.removeAllListeners('request');
  server.on('request', async (request, response) => {
    let path;
    try { path = new URL(request.url, 'http://localhost').pathname; } catch { response.writeHead(400); response.end(); return; }
    if (!path.startsWith(PREVIEW_PATH)) return rootHandler(request, response);
    const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-cache' };
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); response.end(); return; }
    const relative = path.slice(PREVIEW_PATH.length) || 'index.html';
    if (!FILES.has(relative)) { response.writeHead(404, headers); response.end('Not found'); return; }
    try {
      const bytes = await readFile(join(ROOT, COLLECTION, relative));
      response.writeHead(200, { ...headers, 'Content-Type': mime(relative), 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(500, headers); response.end('Preview file unavailable; run the sync check.'); }
  });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4181);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer between 0 and 65535.');
  const server = createPrototypeServer();
  server.on('error', error => { console.error(error.code || error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Answer Lens isolated preview: http://127.0.0.1:${server.address().port}${PREVIEW_PATH}comparison.html`));
  const stop = () => { server.closeAllConnections(); server.close(() => process.exit(0)); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
