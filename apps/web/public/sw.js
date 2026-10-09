const CACHE_VERSION = 'pointnemo-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/assets/runtime/manifest.json',
  '/assets/runtime/water.png',
  '/assets/runtime/buoy.png',
  '/assets/runtime/explorer.png',
  '/assets/runtime/blobfish.png',
  '/assets/runtime/barreleye.png',
  '/assets/runtime/gulper.png',
  '/assets/runtime/goblin.png',
  '/assets/runtime/fringehead.png',
  '/assets/runtime/effects.png',
  '/assets/characters/explorer-front.png',
  '/fonts/PressStart2P-Regular.ttf',
  '/fonts/PixelifySans-Variable.ttf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // For API calls, network first with no offline mock
  if (request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Fetch in background to update cache (stale-while-revalidate for local assets)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, toCache));
        return response;
      }).catch(() => {
        // Fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
