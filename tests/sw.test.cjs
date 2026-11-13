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

test('apple UI precaches the app files under its actual registration scope', async () => {
  const w = worker({scope:'http://localhost:4173/xiaochengji-pwa/'});
  await w.event('install');
  assert.ok(w.requested.every(url => url.startsWith('http://localhost:4173/xiaochengji-pwa/')));
  for (const file of ['index.html','style.css?v=apple-ui-20261113c','media-core.js?v=apple-ui-20261113c','main.js?v=apple-ui-20261113c','manifest.json','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','assets/calico-mascot.svg']) {
    assert.ok(w.requested.some(url => url.endsWith(file)), file);
  }
  assert.ok(w.requested.every(url => !url.includes('/legacy/')));
});

test('offline root restores the Apple UI index and retired nested routes redirect to the correct asset root', async () => {
  const w = worker({offline:true});
  const cache = await w.caches.open('smallwins-cache-apple-ui-2026-11-13c');
  await cache.put('index.html', new Response('apple shell'));
  await cache.put('offline.html', new Response('obsolete DOM'));
  assert.equal(await (await w.request('./', {navigation:true})).text(), 'apple shell');
  const retired = await w.request('legacy/', {navigation:true});
  assert.equal(retired.status, 302);
  assert.equal(retired.headers.get('location'), 'https://example.test/xiaochengji-pwa/');
  const obsolete = await w.request('offline.html', {navigation:true});
  assert.equal(obsolete.status, 302);
});

test('a different app cache cannot become this app’s offline response', async () => {
  const w = worker({offline:true});
  const other = await w.caches.open('interview-bank-cache-v1');
  await other.put('missing-resource.json', new Response('unrelated response'));
  assert.equal((await w.request('missing-resource.json')).status, 503);
});

test('unknown script versions never silently receive the current cached script', async () => {
  const w = worker({offline:true});
  const cache = await w.caches.open('smallwins-cache-apple-ui-2026-11-13c');
  await cache.put('main.js?v=apple-ui-20261113c', new Response('current script'));
  assert.equal((await w.request('main.js?v=future')).status, 503);
  assert.equal(await (await w.request('main.js?v=apple-ui-20261113c')).text(), 'current script');
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

test('activation removes the previous release cache after the complete media install', async () => {
  const w = worker();
  await w.caches.open('smallwins-cache-forest-2026-11-02d');
  await w.event('install');
  assert.equal(w.skips, 1);
  await w.event('activate');
  assert.ok(w.deleted.includes('smallwins-cache-forest-2026-11-02d'));
  assert.ok(w.buckets.has('smallwins-cache-apple-ui-2026-11-13c'));
});
