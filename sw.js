// Service Worker for scene-journey PWA
// Cache shell assets only — tiles bypass SW (too many files)

const CACHE_NAME = 'scene-journey-v4';

// Core app shell — small, changes rarely
const SHELL = [
  '/',
  '/index.html',
  '/404.html',
  '/css/main.css',
  '/css/components.css',
  '/css/vendor/leaflet.css',
  '/js/vendor/leaflet.js',
  '/js/app.js',
  '/js/router.js',
  '/js/map.js',
  '/js/route-engine.js',
  '/js/data-loader.js',
  '/js/storage.js',
  '/js/ui/bottom-sheet.js',
  '/js/ui/location-card.js',
  '/js/ui/filter-bar.js',
  '/js/ui/icons.js',
  '/js/utils/geo.js',
  '/js/utils/format.js',
  '/manifest.json'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// Activate — wipe all old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for HTML/data; SW bypass for tiles
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // NEVER cache tiles — too many, let HTTP cache handle them
  if (url.pathname.includes('/assets/tiles/')) return;
  // Don't intercept API calls — cross-origin responses can't be cloned
  if (url.hostname.includes('hereapi.com') ||
      url.hostname.includes('amap.com') ||
      url.hostname.includes('nominatim.openstreetmap.org') ||
      url.hostname.includes('komoot.io')) return;

  const isHtml = event.request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/';

  const isData = url.pathname.includes('/data/');

  if (isHtml || isData) {
    // Network-first, fallback to cache
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Stale-while-revalidate for CSS/JS (fast, but updates in background)
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        });
        return cached || fetchPromise;
      })
    );
  }
});
