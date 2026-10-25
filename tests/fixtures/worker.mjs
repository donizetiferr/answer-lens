// Execute the actual worker in Node, without a browser, sockets or global mocks.
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
export async function workerFixture(path, scope) {
  const handlers = new Map(), entries = new Map(), requests = [];
  const cache = {
    async addAll(paths) { fixture.precached.push(...paths); },
    async match(url) { return entries.get(url)?.clone(); },
    async put(url, response) { entries.set(url, response.clone()); }
  };
  const timers = new Map(); let nextTimer = 0;
  const fixture = { entries, requests, cache, timers, cacheNames: new Set(), deleted: [], precached: [], skipped: false, claimed: false,
    network: async () => new Response('current shell'),
    cacheError: false, expireTimers() { for (const [id, { run }] of timers) { timers.delete(id); run(); } } };
  runInNewContext(await readFile(path, 'utf8'), {
    URL, Response, AbortController,
    setTimeout(run, delay) { const id = ++nextTimer; timers.set(id, { run, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    self: { registration: { scope }, addEventListener: (type, handler) => handlers.set(type, handler),
      async skipWaiting() { fixture.skipped = true; }, clients: { async claim() { fixture.claimed = true; } } },
    caches: {
      async open(name) { if (fixture.cacheError) throw new Error('Cache storage denied'); fixture.cacheNames.add(name); return cache; },
      async keys() { return [...fixture.cacheNames]; },
      async delete(name) { fixture.deleted.push(name); return fixture.cacheNames.delete(name); }
    },
    fetch: async (request, options) => { requests.push({ request, options }); return fixture.network(request, options); }
  });
  // Lifecycle tests exercise ordering and namespace selection, not the native
  // browser's atomic Cache.addAll or page-controller implementation.
  fixture.lifecycle = async type => {
    const pending = [];
    handlers.get(type)({ waitUntil(promise) { pending.push(promise); } });
    await Promise.all(pending);
  };
  fixture.request = async (path, method = 'GET') => {
    let response;
    const pending = [];
    handlers.get('fetch')({ request: new Request(new URL(path, scope), { method }),
      respondWith(promise) { response = promise; }, waitUntil(promise) { pending.push(promise); } });
    const result = await response;
    await Promise.all(pending);
    return result;
  };
  return fixture;
}
