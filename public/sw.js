/* Punjab-SMS service worker — network-first shell + versioned PWA icons. */
const ASSET_REV = "20261027-emblem";
const CACHE_VERSION = `psms-cache-${ASSET_REV}`;

function appRootUrl() {
  return new URL(".", self.location).href;
}

function versioned(fileName) {
  return new URL(`${fileName}?v=${encodeURIComponent(ASSET_REV)}`, appRootUrl()).href;
}

function appShellUrls() {
  const root = appRootUrl();
  return {
    root,
    index: new URL("index.html", root).href,
    manifest: versioned("manifest.webmanifest"),
    favicon: versioned("favicon.png"),
    icon192: versioned("pwa-icon-192.png"),
    icon512: versioned("pwa-icon-512.png"),
    iconMaskable: versioned("pwa-icon-512-maskable.png"),
    apple: versioned("apple-touch-icon.png"),
    brand: versioned("app-brand-logo.png"),
  };
}

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept");
  return typeof accept === "string" && accept.includes("text/html");
}

function isVersionedAsset(pathname) {
  return (
    pathname.endsWith("/manifest.webmanifest") ||
    pathname.endsWith("/favicon.png") ||
    pathname.endsWith("/favicon.svg") ||
    pathname.endsWith("/apple-touch-icon.png") ||
    pathname.endsWith("/app-brand-logo.png") ||
    pathname.endsWith("/app-brand.png") ||
    /\/pwa-icon-\d+/.test(pathname) ||
    pathname.endsWith("/pwa-ico.png") ||
    pathname.endsWith("/pwa-asset-rev.json")
  );
}

async function precacheIcons(cache) {
  const urls = appShellUrls();
  const list = [
    urls.root,
    urls.index,
    urls.manifest,
    urls.favicon,
    urls.icon192,
    urls.icon512,
    urls.iconMaskable,
    urls.apple,
    urls.brand,
  ];
  await Promise.all(
    list.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res && res.ok) await cache.put(url, res.clone());
      } catch {
        /* offline install — ignore */
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => precacheIcons(cache))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      // Warm the new icon set so launchers/clients see the updated mark ASAP.
      try {
        const cache = await caches.open(CACHE_VERSION);
        await precacheIcons(cache);
      } catch {
        /* ignore */
      }
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "PSMS_ASSETS_UPDATED", rev: ASSET_REV });
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "GET_ASSET_REV") {
    event.source?.postMessage?.({ type: "PSMS_ASSET_REV", rev: ASSET_REV });
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const path = url.pathname;

  if (path.endsWith("/sw.js") || path === "/sw.js") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (isHtmlNavigation(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          return networkRes;
        })
        .catch(() => caches.match(appShellUrls().index)),
    );
    return;
  }

  if (path.includes("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          return networkRes;
        });
      }),
    );
    return;
  }

  // Manifest + icons: always try network first (bypass HTTP cache) so every device gets new art.
  if (isVersionedAsset(path)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((networkRes) => {
          if (!networkRes || !networkRes.ok) return networkRes;
          const copy = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, copy);
            // Also store under the versioned shell key when paths match.
          }).catch(() => undefined);
          return networkRes;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (!networkRes || !networkRes.ok) return networkRes;
        const copy = networkRes.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
        return networkRes;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match(appShellUrls().index))),
  );
});
