/* Apple-like UI release: cache app files only; records and preferences stay local. */
const VERSION = 'apple-ui-2026-11-12c';
const CACHE_NAME = `smallwins-cache-${VERSION}`;
const BASE = self.registration.scope;
const UI_VERSION = 'apple-ui-20261112c';
const absolute = path => new URL(path, BASE).href;
const APP_SHELL = [
  'index.html', `style.css?v=${UI_VERSION}`, `media-core.js?v=${UI_VERSION}`, `main.js?v=${UI_VERSION}`,
  'manifest.json', 'offline.html',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'assets/calico-mascot.svg',
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
  const path = new URL(request.url).pathname;
  const base = new URL(BASE).pathname;
  // Retired /legacy/ bookmarks must resolve assets from the canonical app root.
  if (path !== base && path !== new URL('index.html', BASE).pathname) {
    return Response.redirect(BASE, 302);
  }
  const cache = await caches.open(CACHE_NAME);
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 4000);
  try {
    const response = await fetch(new Request(request, {cache: 'no-store', signal: abort.signal}));
    if (response.ok) return response;
  } catch { /* Offline: restore the same classic interface from this release. */ }
  finally { clearTimeout(timeout); }
  const shell = await cache.match(absolute('index.html'));
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
