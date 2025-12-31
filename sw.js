const CACHE_NAME = 'studios-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './services/firebase.js',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache Hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
