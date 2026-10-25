// App shell only: never cache user answers, exports, or arbitrary requests.
const PREFIX = `answer-lens-shell:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}2.0.0`;
const FILES = ['./', './index.html', './styles.css', './icon.svg', './src/app.js', './src/core.js', './src/storage.js', './src/demo.js', './src/output.js'];
const URLS = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url); url.search = ''; url.hash = '';
  if (event.request.method !== 'GET' || !URLS.has(url.href)) return;
  event.respondWith((async () => {
    // A cache-first shell pins an installed app to old source bytes, even when
    // those files change without a product-version bump. Refresh on each load;
    // keep the last successful shell available when the network is unavailable.
    const cache = await caches.open(CACHE).catch(() => null);
    const fallback = await cache?.match(url.href).catch(() => undefined);
    const controller = new AbortController();
    // A captive portal or stalled connection must not strand an offline-ready
    // app. Only impose a deadline when there is a usable cached response.
    const deadline = fallback ? setTimeout(() => controller.abort(), 3000) : null;
    let response;
    try {
      response = await fetch(event.request, { cache: 'no-cache', signal: controller.signal });
      // Fetch resolves at the headers. Keep the deadline until a successful
      // shell body is complete, so interrupted scripts also get the fallback.
      if (response.ok) await response.clone().arrayBuffer();
    }
    catch (error) {
      if (fallback) return fallback;
      throw error;
    } finally { if (deadline !== null) clearTimeout(deadline); }
    if (!response.ok) return fallback || response;
    if (cache) event.waitUntil(cache.put(url.href, response.clone()).catch(() => {}));
    return response;
  })());
});
