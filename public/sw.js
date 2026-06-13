// ============================================================
//  SERVICE WORKER — offline rejim (qo'lda, kutubxonasiz)
// ------------------------------------------------------------
//  - Navigatsiya (HTML): avval tarmoq, internetsiz bo'lsa kesh.
//  - Same-origin assetlar (JS/CSS/rasm): stale-while-revalidate
//    (keshdan tez beradi, fonda yangilaydi).
//  - Tashqi so'rovlar (Firebase, cbu.uz kursi va h.k.) — tegilmaydi,
//    to'g'ridan-to'g'ri tarmoqqa ketadi.
//  Yangi versiya chiqsa CACHE nomidagi raqamni oshiring.
// ============================================================
const CACHE = 'tunika-v4';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Tashqi so'rovlar (Firebase, kurs API va h.k.) — SW aralashmaydi
  if (url.origin !== self.location.origin) return;

  // HTML navigatsiyasi — avval tarmoq, offline bo'lsa kesh
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Boshqa same-origin GET (assetlar) — stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
