/* sw.js — Small Wins PWA (GitHub Pages friendly)
 * - Offline cache (App Shell + runtime cache)
 * - Correct scope for /xiaochengji-pwa/
 * - Update strategy: skipWaiting + clientsClaim
 */

const VERSION = "v2026-02-15-08";
const CACHE_NAME = `smallwins-cache-${VERSION}`;
const RUNTIME_CACHE = `smallwins-runtime-${VERSION}`;

// ✅ GitHub Pages 子路径（非常关键）
const BASE_PATH = "/xiaochengji-pwa/";

// ✅ App Shell：首次安装就缓存，离线也能打开
const APP_SHELL = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}style.css`,
  `${BASE_PATH}main.js`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icons/icon-192.png`,
  `${BASE_PATH}icons/icon-512.png`,
];

// --- Install: precache app shell ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll 任意一个失败会整体失败，所以用逐个加更稳
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const req = new Request(url, { cache: "reload" });
            const res = await fetch(req);
            if (res && res.ok) await cache.put(req, res);
          } catch (e) {
            // 某个资源没拉到也别让安装失败（尤其是首次偶发网络问题）
            console.warn("[SW] precache failed:", url, e);
          }
        })
      );
      // 让新 SW 立刻进入 waiting -> active
      await self.skipWaiting();
    })()
  );
});

// --- Activate: clean old caches + claim clients ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME && k !== RUNTIME_CACHE) return caches.delete(k);
        })
      );
      await self.clients.claim();
    })()
  );
});

// Helpers
function isSameOrigin(requestUrl) {
  try {
    const u = new URL(requestUrl);
    return u.origin === self.location.origin;
  } catch {
    return false;
  }
}

function isUnderBasePath(requestUrl) {
  try {
    const u = new URL(requestUrl);
    return u.pathname.startsWith(BASE_PATH);
  } catch {
    return false;
  }
}

// --- Fetch strategy ---
// 1) HTML 导航：Network First（保证更新），失败回退缓存 index.html
// 2) 静态资源：Stale-While-Revalidate（秒开 + 后台更新）
// 3) 其他请求：Network First，失败才用缓存兜底
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 只处理 GET
  if (req.method !== "GET") return;

  // 只处理同源、且在 /xiaochengji-pwa/ 目录下的请求（避免污染别的站点资源）
  if (!isSameOrigin(req.url) || !isUnderBasePath(req.url)) return;

  const accept = req.headers.get("accept") || "";
  const url = new URL(req.url);

  // ✅ 1) 页面导航（用户直接打开、刷新、从桌面启动）
  const isNav =
    req.mode === "navigate" ||
    (accept.includes("text/html") && !url.pathname.endsWith(".css") && !url.pathname.endsWith(".js"));

  if (isNav) {
    event.respondWith(
      (async () => {
        try {
          // Network First：优先拿最新
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // 离线：回退到缓存的 index.html（App Shell）
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match(`${BASE_PATH}index.html`);
          return cachedIndex || new Response("离线中，且未找到缓存。", { status: 503 });
        }
      })()
    );
    return;
  }

  // ✅ 2) 静态资源：css/js/png/svg等，用 SWR 策略
  const isStatic =
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".ico");

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);

        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);

        // 先返回缓存，后台更新
        return cached || (await fetchPromise) || new Response("离线中，资源不可用。", { status: 503 });
      })()
    );
    return;
  }

  // ✅ 3) 其他请求：Network First
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || new Response("离线中，请稍后重试。", { status: 503 });
      }
    })()
  );
});
