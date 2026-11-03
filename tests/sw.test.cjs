const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker({scope = 'https://example.test/xiaochengji-pwa/', offline = false, failAsset = ''} = {}) {
  const handlers = {}, buckets = new Map(), deleted = [], requested = [];
  let skips = 0, claims = 0;
  const origin = new URL(scope).origin;
  const key = value => typeof value === 'string' ? new URL(value, scope).href : value.url;
  const network = async request => {
    const url = key(request); requested.push(url);
    if (offline || (failAsset && url.includes(failAsset))) throw new Error('offline');
    return new Response(url.includes('/legacy/') ? 'legacy page' : 'new page');
  };
  const caches = {
    async open(name) {
      if (!buckets.has(name)) {
        const entries = new Map();
        buckets.set(name, {
          entries,
          async addAll(urls) {
            const pairs = await Promise.all(urls.map(async url => [key(url), await network(url)]));
            pairs.forEach(([url, res]) => entries.set(url, res));
          },
          async put(request, response) { entries.set(key(request), response); },
          async match(request, options = {}) {
            let url = key(request);
            for (const [stored, response] of entries) {
              let candidate = stored;
              if (options.ignoreSearch) { url = url.split('?')[0]; candidate = candidate.split('?')[0]; }
              if (url === candidate) return response.clone();
            }
          },
        });
      }
      return buckets.get(name);
    },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { deleted.push(name); return buckets.delete(name); },
    async match(request) {
      for (const cache of buckets.values()) { const res = await cache.match(request); if (res) return res; }
    },
  };
  const context = {
    self: {
      location: new URL(scope + 'sw.js'), registration: {scope},
      addEventListener: (type, callback) => handlers[type] = callback,
      skipWaiting: async () => skips++, clients: {claim: async () => claims++},
    },
    caches, fetch: network, URL, Response, AbortController, setTimeout, clearTimeout,
    Request: class extends Request { constructor(url, options) { super(new URL(key(url), scope), options); } },
    console: {warn() {}},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'), 'utf8'), context);
  return {
    buckets, caches, deleted, requested, get skips() { return skips; }, get claims() {return claims;},
    async event(type) {
      let pending;
      handlers[type]({waitUntil: promise => pending = promise});
      return pending;
    },
    async request(path, {navigation = false} = {}) {
      let response, pending;
      const req = new Request(new URL(path, scope), {headers: navigation ? {accept:'text/html'} : {}});
      if (navigation) Object.defineProperty(req, 'mode', {value:'navigate'});
      handlers.fetch({request:req, respondWith:p => response = p, waitUntil:p => pending = p});
      const result = await response;
      if (pending) await pending;
      return result;
    },
  };
}

test('failed precache leaves the current worker active instead of activating an incomplete app', async () => {
  const w = worker({failAsset:'main.js'});
  await w.caches.open('smallwins-cache-existing');
  await assert.rejects(w.event('install'), /offline/);
  assert.equal(w.skips, 0);
  assert.ok(w.buckets.has('smallwins-cache-existing'));
});

test('activation removes only obsolete Small Wins caches', async () => {
  const w = worker();
  await w.event('install');
  await w.caches.open('smallwins-cache-old');
  await w.caches.open('smallwins-runtime-old');
  await w.caches.open('interview-bank-cache-v1');
  await w.event('activate');
  assert.ok(w.buckets.has('interview-bank-cache-v1'));
  assert.deepEqual(w.deleted.sort(), ['smallwins-cache-old','smallwins-runtime-old']);
  assert.equal(w.claims, 1);
});

test('precache follows the registration scope and includes both interfaces and forest assets', async () => {
  const w = worker({scope:'http://localhost:4173/product/'});
  await w.event('install');
  assert.ok(w.requested.every(url => url.startsWith('http://localhost:4173/product/')));
  for (const file of ['legacy/index.html','legacy/main.js','legacy/style.css','assets/home-hero.webp','assets/record-hero.webp','assets/wall-hero.webp','assets/review-hero.webp','assets/settings-hero.webp','assets/icons/house.svg']) {
    assert.ok(w.requested.some(url => url.endsWith(file)), file);
  }
  assert.ok(w.requested.some(url => url.endsWith('main.js?v=forest-20261102d')));
});

test('offline navigation chooses the legacy shell for legacy URLs and the new shell for the root', async () => {
  const w = worker({offline:true});
  const cache = await w.caches.open('smallwins-cache-forest-2026-11-02d');
  await cache.put('index.html', new Response('new shell'));
  await cache.put('legacy/index.html', new Response('old shell'));
  assert.equal(await (await w.request('./', {navigation:true})).text(), 'new shell');
  assert.equal(await (await w.request('legacy/', {navigation:true})).text(), 'old shell');
});

test('a different app cache cannot become this app’s offline response', async () => {
  const w = worker({offline:true});
  const other = await w.caches.open('interview-bank-cache-v1');
  await other.put('missing-resource.json', new Response('unrelated response'));
  assert.equal((await w.request('missing-resource.json')).status, 503);
});

test('unknown script versions never silently receive the current cached script', async () => {
  const w = worker({offline:true});
  const cache = await w.caches.open('smallwins-cache-forest-2026-11-02d');
  await cache.put('main.js?v=forest-20261102d', new Response('current script'));
  assert.equal((await w.request('main.js?v=future')).status, 503);
  assert.equal(await (await w.request('main.js?v=forest-20261102d')).text(), 'current script');
});

test('requests outside this registration are left to the browser', async () => {
  const w = worker();
  assert.equal(await w.request('https://example.test/interview-bank/'), undefined);
});

test('every precached resource exists in the release and versioned scripts match the HTML', async () => {
  const w = worker();
  await w.event('install');
  const root = require('node:path').resolve(__dirname, '..');
  const html = fs.readFileSync(require('node:path').join(root, 'index.html'), 'utf8');
  for (const url of w.requested) {
    const parsed = new URL(url);
    const file = parsed.pathname.replace('/xiaochengji-pwa/', '');
    assert.ok(fs.statSync(require('node:path').join(root, file)).isFile(), file);
    if (parsed.search) assert.ok(html.includes('./' + file + parsed.search), file + ' version mismatch');
  }
});
