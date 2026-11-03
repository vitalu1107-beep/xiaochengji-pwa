/* One complete cache per release; both UIs share origin-local data, never cached here. */
const VERSION = 'forest-2026-11-02d';
const CACHE_NAME = `smallwins-cache-${VERSION}`;
const BASE = self.registration.scope;
const UI_VERSION = 'forest-20261102d';
const absolute = path => new URL(path, BASE).href;
const APP_SHELL = [
  'index.html', `style.css?v=${UI_VERSION}`, `main.js?v=${UI_VERSION}`,
  'manifest.json', 'offline.html',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'legacy/index.html', 'legacy/style.css', 'legacy/main.js',
  'legacy/icons/icon-180.png', 'legacy/icons/icon-192.png', 'legacy/icons/icon-512.png',
  ...['home', 'record', 'wall', 'review', 'settings'].map(page => `assets/${page}-hero.webp`),
  ...['house','pencil-simple','trophy','book-open','gear','heart','magnifying-glass','chevron-right','copy','smiley','x','trash','arrow-left'].map(name => `assets/icons/${name}.svg`),
  ...['house','pencil-simple','trophy','book-open','gear'].map(name => `assets/icons/${name}-fill.svg`),
].map(absolute);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache.addAll is atomic: any missing resource rejects the install.
    await cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(name => name !== CACHE_NAME &&
      (name.startsWith('smallwins-cache-') || name.startsWith('smallwins-runtime-'))).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function navigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 4000);
  try {
    const response = await fetch(new Request(request, {cache: 'no-store', signal: abort.signal}));
    if (response.ok) return response;
  } catch { /* offline: use the correct interface shell */ }
  finally { clearTimeout(timeout); }
  const path = new URL(request.url).pathname;
  const legacy = path.startsWith(new URL('legacy/', BASE).pathname);
  const shell = await cache.match(absolute(legacy ? 'legacy/index.html' : 'index.html'));
  return shell || new Response('暂时离线，首次打开请先连接网络。', {status: 503, headers:{'Content-Type':'text/plain;charset=utf-8'}});
}
async function resource(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try { return await fetch(request); }
  catch { return new Response('离线资源暂不可用。', {status:503}); }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const base = new URL(BASE);
  if (request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  const isNavigation = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  event.respondWith(isNavigation ? navigation(request) : resource(request));
});
