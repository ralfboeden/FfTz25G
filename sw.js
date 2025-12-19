const CACHE_VERSION = "v2";
const APP_SHELL_CACHE = `fotobuch-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE   = `fotobuch-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./manifest.json"
];

// ✅ QR-Codes: immer offline
function buildQrAssets(){
  const assets = [];
  for(let y=2000; y<=2025; y++){
    assets.push(`./img/qr-codes/${y}_film_qr.png`);
    assets.push(`./img/qr-codes/${y}_music_qr.png`);
  }
  return assets;
}

self.addEventListener("install", (event) => {
  const qrAssets = buildQrAssets();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll([...SHELL_ASSETS, ...qrAssets]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// HTML: network-first (Updates kommen an), fallback cache
// Bilder: cache-first (schnell), beim ersten Laden in runtime cache
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const isHTML = req.headers.get("accept")?.includes("text/html");
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_SHELL_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  const isImage = req.destination === "image" || url.pathname.includes("/img/");
  if (isImage) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(caches.match(req).then((c) => c || fetch(req)));
});
