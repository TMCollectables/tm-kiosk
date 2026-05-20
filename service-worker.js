// TM Collectables Kiosk - Service Worker
// Version 1.0

const CACHE_NAME = 'tm-kiosk-v1';
const RUNTIME_CACHE = 'tm-kiosk-runtime-v1';

// Files to cache immediately on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Precaching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
          .map(cacheName => {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // For card images from TCGPlayer CDN
  if (url.hostname.includes('tcgplayer-cdn.tcgplayer.com')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache => {
        return cache.match(request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // Not in cache - fetch and cache
          return fetch(request).then(response => {
            // Only cache successful responses
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(err => {
            console.log('[ServiceWorker] Fetch failed for:', request.url);
            // Return a placeholder or cached version if available
            return cache.match(request);
          });
        });
      })
    );
    return;
  }

  // For app shell (HTML, CSS, JS)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(response => {
        // Cache the new resource
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    }).catch(err => {
      console.log('[ServiceWorker] Fetch failed:', err);
      // Return offline page or cached version
      return caches.match('./index.html');
    })
  );
});
