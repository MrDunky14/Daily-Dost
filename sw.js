const CACHE_NAME = 'studios-v2';
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

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Stale-While-Revalidate for HTML, JS, CSS (Mutable App Files)
  if (requestUrl.pathname.endsWith('.html') || 
      requestUrl.pathname.endsWith('.js') || 
      requestUrl.pathname.endsWith('.css') ||
      requestUrl.pathname === '/') {
    
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const networkFetch = fetch(event.request).then((response) => {
          // Update cache with new version
          if (response && response.status === 200 && response.type === 'basic') {
             cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {
           // Network failed, nothing to do (cache was already returned if available)
        });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // Cache-First for everything else (Images, Fonts, etc.)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
