/*
 * SHĀZDEH service worker.
 *
 * Registered as /sw.js?v=<build id> (see src/components/pwa/service-worker.tsx),
 * so every deploy installs a fresh worker with its own caches.
 *
 * What it does — and, as importantly, what it leaves alone:
 *
 *   /_next/static/*        cache-first   content-hashed, immutable
 *   images, /icons/*       stale-while-revalidate, capped
 *   public pages (HTML)    network-first, cached copy only when offline
 *   everything else HTML   network-only, offline page when the network fails
 *   /api/*, non-GET,       never touched — the browser talks to the server
 *   RSC payloads,          directly, exactly as without a service worker
 *   cross-origin           (auth, orders, payments, tracking, uploads)
 *
 * Only pages that render the same for every visitor are ever cached
 * (PUBLIC_PAGES). Admin, login, checkout, payment and order tracking are
 * never written to a cache, so nothing private can be served to another
 * session or survive a sign-out.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PREFIX = "shazdeh-";
const STATIC_CACHE = `${PREFIX}static-${VERSION}`;
const PAGES_CACHE = `${PREFIX}pages-${VERSION}`;
// Images are not tied to a build, so they survive deploys.
const IMAGES_CACHE = `${PREFIX}images-v1`;
const CURRENT = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];

const OFFLINE_URL = "/offline";
// The app shell: available offline from the first visit.
const SHELL_PAGES = ["/", "/menu"];
const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
];

const MAX_IMAGES = 120;
const MAX_PAGES = 40;
// On a slow connection, fall back to a cached public page after this long.
const NAVIGATION_TIMEOUT_MS = 5000;

// Pages identical for every visitor. Keep this list conservative: anything
// personal, live (prices/availability) or authenticated must not match.
const PUBLIC_PAGES = [
  /^\/$/,
  /^\/menu$/,
  /^\/menu\/[a-z0-9-]+$/,
  /^\/about$/,
  /^\/gallery$/,
  /^\/legal\/[a-z0-9-]+$/,
  /^\/order\/apps$/,
];

const IMAGE_EXT = /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i;

function isPublicPage(url) {
  return PUBLIC_PAGES.some((re) => re.test(url.pathname));
}

/** Same-origin, complete, non-redirected 200s only. */
function isCacheable(res) {
  return res && res.ok && res.status === 200 && res.type === "basic" && !res.redirected;
}

/** Collects the CSS/JS/font URLs a page needs so it can render offline. */
async function assetsOf(res) {
  const html = await res.clone().text();
  const urls = new Set();
  for (const m of html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)) {
    urls.add(m[1].replace(/&amp;/g, "&"));
  }
  return [...urls];
}

async function precachePage(path, pagesCache, staticCache) {
  // Without cookies: what gets stored is the anonymous render, always.
  const res = await fetch(path, { cache: "reload", credentials: "omit" });
  if (!isCacheable(res)) throw new Error(`precache ${path}: ${res.status}`);
  const assets = await assetsOf(res);
  await pagesCache.put(path, res);
  await Promise.allSettled(assets.map((a) => staticCache.add(a)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const [pages, statics] = await Promise.all([
        caches.open(PAGES_CACHE),
        caches.open(STATIC_CACHE),
      ]);
      // The offline page is required; everything else is best-effort so a
      // single failing page never blocks the worker from installing.
      await precachePage(OFFLINE_URL, pages, statics);
      await Promise.allSettled([
        ...SHELL_PAGES.map((p) => precachePage(p, pages, statics)),
        statics.addAll(SHELL_ASSETS),
      ]);
    })(),
  );
  // No skipWaiting() here: the page asks for it when the user agrees to
  // refresh, so a running checkout is never swapped onto a new build.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(PREFIX) && !CURRENT.includes(k))
          .map((k) => caches.delete(k)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  // Oldest first (insertion order); the offline page is never evicted.
  const keys = (await cache.keys()).filter(
    (k) => new URL(k.url).pathname !== OFFLINE_URL,
  );
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function cacheFirst(event, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (isCacheable(res)) event.waitUntil(cache.put(event.request, res.clone()));
  return res;
}

async function staleWhileRevalidate(event, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then(async (res) => {
      if (isCacheable(res)) {
        await cache.put(event.request, res.clone());
        if (max) await trim(cacheName, max);
      }
      return res;
    });
  if (hit) {
    event.waitUntil(refresh.catch(() => {}));
    return hit;
  }
  return refresh;
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

async function offlineFallback() {
  const cache = await caches.open(PAGES_CACHE);
  return (
    (await cache.match(OFFLINE_URL)) ||
    new Response("<h1>You are offline</h1>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );
}

async function handleNavigation(event) {
  const url = new URL(event.request.url);
  const cacheable = isPublicPage(url);
  // Cache by path: query strings (utm_*, filters) never change these pages.
  const key = url.pathname;

  const network = (async () => {
    const res = (await event.preloadResponse) || (await fetch(event.request));
    if (cacheable && isCacheable(res)) {
      const copy = res.clone();
      event.waitUntil(
        caches
          .open(PAGES_CACHE)
          .then((c) => c.put(key, copy))
          .then(() => trim(PAGES_CACHE, MAX_PAGES)),
      );
    }
    return res;
  })();

  if (!cacheable) {
    try {
      return await network;
    } catch {
      return offlineFallback();
    }
  }

  const cached = await caches.open(PAGES_CACHE).then((c) => c.match(key));
  try {
    if (!cached) return await network;
    // Slow network + a saved copy → show the copy; the network response
    // still lands in the cache for next time.
    const res = await Promise.race([network, timeout(NAVIGATION_TIMEOUT_MS)]);
    if (res) return res;
    event.waitUntil(network.catch(() => {}));
    return cached;
  } catch {
    return cached || offlineFallback();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // React Server Component payloads for client-side navigation: always
  // fresh from the server; on failure Next falls back to a full page load,
  // which handleNavigation then covers.
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;
  // Media streaming (video) uses range requests — leave them to the browser.
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, STATIC_CACHE));
    return;
  }

  if (url.pathname === "/_next/image" || (IMAGE_EXT.test(url.pathname) && !url.pathname.startsWith("/admin"))) {
    event.respondWith(staleWhileRevalidate(event, IMAGES_CACHE, MAX_IMAGES));
    return;
  }

  if (url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(event, STATIC_CACHE));
  }
});

// Web Push (src/lib/notifications/push.ts): order status for customers,
// new orders for staff. Arrives even when no SHĀZDEH tab is open.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "SHĀZDEH", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "SHĀZDEH", {
      body: data.body || "",
      tag: data.tag,
      renotify: Boolean(data.tag),
      requireInteraction: Boolean(data.requireInteraction),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

// Notification taps (push, and the kitchen alarm in
// src/components/admin/orders/kitchen-alerts.ts): focus an open tab on
// that page, or open one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin/orders", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).pathname.startsWith(target.pathname));
      if (open) return open.focus();
      return self.clients.openWindow(target.href);
    })(),
  );
});
