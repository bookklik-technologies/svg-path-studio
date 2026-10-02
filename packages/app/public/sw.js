/** Fresh pages online; cached assets and app shell for offline use. */
const CACHE = 'sps-v3';
const ASSETS = ['./', './index.html', './icon.svg', './logo.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('sps-') && k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.registration.scope)) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(async (res) => {
          if (res.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(e.request, res.clone());
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          const page = await cache.match(e.request) ?? await cache.match('./index.html');
          if (page) return page;
          throw new Error('No offline page available');
        })
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((cache) => cache.match(e.request).then(
      (hit) =>
        hit ??
        fetch(e.request)
          .then((res) => {
            if (res.ok && e.request.url.startsWith(self.location.origin)) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, clone));
            }
            return res;
          })
    ))
  );
});
