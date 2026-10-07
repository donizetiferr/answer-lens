// App shell only: never cache user answers, exports, or arbitrary requests.
const PREFIX = `answer-lens-preview-shell:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}2.0.0-catalog-r3-viewer-shell-c37f5664d2fc61692fcbb339f7538ee72e6002188947816a6ba04cecc6f986a3`;
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
// Read-only readiness receipt: no user data is included or cached by this message.
self.addEventListener('message', event => {
  if (event.data?.type !== 'answer-lens-shell-status' || !event.ports[0]) return;
  const reply = available => event.ports[0].postMessage({ type: 'answer-lens-shell-status', available });
  event.waitUntil(Promise.all([...URLS].map(url => caches.match(url, { cacheName: CACHE })))
    .then(entries => reply(entries.every(Boolean))).catch(() => reply(false)));
});
