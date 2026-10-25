// Execute the actual worker in Node, without a browser, sockets or global mocks.
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
export async function workerFixture(path, scope) {
  const handlers = new Map(), entries = new Map(), requests = [];
  const cache = {
    async match(url) { return entries.get(url)?.clone(); },
    async put(url, response) { entries.set(url, response.clone()); }
  };
  const fixture = { entries, requests, cache, network: async () => new Response('current shell'),
    cacheError: false };
  runInNewContext(await readFile(path, 'utf8'), {
    URL, Response,
    self: { registration: { scope }, addEventListener: (type, handler) => handlers.set(type, handler) },
    caches: { async open() { if (fixture.cacheError) throw new Error('Cache storage denied'); return cache; } },
    fetch: async (request, options) => { requests.push({ request, options }); return fixture.network(request); }
  });
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
