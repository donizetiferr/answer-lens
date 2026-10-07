// App shell only: never cache user answers, exports, or arbitrary requests.
const PREFIX = `answer-lens-preview-shell:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}2.0.0-catalog-r3-viewer-shell-c247f7694753494c5f3056eb381b8ed932fda4f2f91176e7d0e4d0ccd5f9e10b`;
const FILES = ['./', './index.html', './comparison.html', './mobile.html', './styles.css', './icon.svg', './src/app.js', './src/core.js', './src/storage.js', './src/demo.js', './src/output.js'];
const URLS = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url); url.search = ''; url.hash = '';
  if (event.request.method !== 'GET' || !URLS.has(url.href)) return;
  // A late request from the previous worker must not recreate its deleted cache.
  event.respondWith(caches.match(url.href, { cacheName: CACHE }).then(cached => cached || fetch(event.request)));
});
