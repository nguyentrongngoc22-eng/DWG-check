/* CSD Drawing Checker — service worker
 *
 * Bump CACHE when you publish a new build, otherwise phones that already
 * installed the app keep serving the old index.html from cache forever.
 */
const CACHE = 'csd-checker-v2.6.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Cache-first: the whole app is one file and nothing is fetched at runtime,
     so serving from cache is both correct and what makes it work on site with
     no signal. The network copy refreshes the cache in the background. */
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);

      return hit || fetched;
    })
  );
});
