const CACHE_NAME = "kasir-toko-v2";
const CORE_ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// PENTING: hanya file aplikasi sendiri (HTML/JS/ikon di domain ini) yang boleh
// di-cache. Semua request ke domain lain (Supabase, CDN, dsb) SELALU harus
// diambil langsung dari internet, tidak pernah dari cache -- karena isinya
// data toko yang berubah-ubah (item, transaksi, foto). Kalau ini ikut
// di-cache, refresh halaman akan menampilkan data BASI walau data asli di
// server sudah benar ter-update.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isSameOrigin = new URL(req.url).origin === self.location.origin;
  if (!isSameOrigin) {
    // Request ke luar (Supabase API, CDN, dsb): selalu ambil langsung dari
    // jaringan, jangan pernah dijawab dari cache Service Worker ini.
    return;
  }

  if (req.mode === "navigate" || req.destination === "document") {
    // Network-first untuk HTML: selalu ambil versi terbaru saat online,
    // fallback ke cache hanya kalau benar-benar offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Aset statis milik aplikasi sendiri (ikon, manifest): cache-first, aman
  // karena isinya tidak berubah-ubah seperti data toko.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
    })
  );
});
