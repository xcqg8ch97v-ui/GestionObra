/* ========================================
   Service Worker - Gestión de Obra PWA
   Cache-first strategy for offline support
   ======================================== */

const CACHE_NAME = 'gestion-obra-v3';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/app.js',
  './js/modules/canvas.js',
  './js/modules/dashboard.js',
  './js/modules/timeline.js',
  './js/modules/diary.js',
  './js/modules/overview.js',
  './js/modules/files.js',
  './js/modules/participants.js',
  './js/modules/report.js',
  './manifest.json'
];

// Install - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - cache first, then network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // For CDN resources, try network first
  if (event.request.url.includes('unpkg.com') || 
      event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For local assets, network first (so updates are always served)
  event.respondWith(
    fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
