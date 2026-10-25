// App shell only: never cache user answers, exports, or arbitrary requests.
const PREFIX = `answer-lens-preview-shell:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}2.0.0-catalog-r3-viewer`;
const FILES = ['./', './index.html', './comparison.html', './mobile.html', './styles.css', './icon.svg', './src/app.js', './src/core.js', './src/storage.js', './src/demo.js', './src/output.js'];
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
    const cached = () => cache?.match(url.href).catch(() => undefined);
    let response;
    try { response = await fetch(event.request, { cache: 'no-cache' }); }
    catch (error) {
      const fallback = await cached();
      if (fallback) return fallback;
      throw error;
    }
    if (!response.ok) return (await cached()) || response;
    if (cache) event.waitUntil(cache.put(url.href, response.clone()).catch(() => {}));
    return response;
  })());
});
