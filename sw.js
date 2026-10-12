/**
 * sw.js — Service Worker for FinPulse PWA
 * Caches app shell for offline use.
 */

const CACHE_NAME = 'finpulse-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/main.css',
  './js/db.js',
  './js/models.js',
  './js/services.js',
  './js/ui.js',
  './js/charts.js',
  './js/app.js',
  './manifest.json',
];

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(() => {
      // Silently ignore if some assets fail to cache
    })
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache, fall back to network (cache-first strategy)
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin resources
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache new resources dynamically (fonts, chart.js CDN)
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Return offline fallback if available
        return caches.match('./index.html');
      });
    })
  );
});
