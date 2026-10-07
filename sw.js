// App shell only: never cache user answers, exports, or arbitrary requests.
const PREFIX = `answer-lens-shell:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}2.0.0-shell-14a8335f4bb8339516ab153597d3089139e8b80515a52eadc7a66c19fb1c433c`;
const FILES = ['./', './index.html', './styles.css', './icon.svg', './src/app.js', './src/core.js', './src/storage.js', './src/demo.js', './src/output.js'];
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
