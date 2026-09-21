// Development-only static app server. Bound to localhost, with a fixed file allowlist.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']], ['/icon.svg', ['icon.svg', 'image/svg+xml']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ...['app', 'core', 'storage', 'demo', 'output'].map(name => [`/src/${name}.js`, [`src/${name}.js`, 'text/javascript; charset=utf-8']])
]);
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export function createAppServer() {
  return http.createServer(async (request, response) => {
    const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-cache', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); response.end(); return; }
    let entry;
    try { entry = files.get(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400, headers); response.end(); return; }
    if (!entry) { response.writeHead(404, headers); response.end('Not found'); return; }
    try {
      const body = await readFile(resolve(ROOT, entry[0]));
      response.writeHead(200, { ...headers, 'Content-Type': entry[1], 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(500, headers); response.end('App file unavailable'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be between 0 and 65535.');
  const server = createAppServer();
  server.on('error', error => { console.error(`Answer Lens server: ${error.code || error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Answer Lens: http://127.0.0.1:${server.address().port} (loopback only)`));
  const stop = () => { server.closeAllConnections(); server.close(() => process.exit(0)); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
