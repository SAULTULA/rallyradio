const CACHE_NAME = 'rallyradio-v1';

// Estrategia: "Network First" (Red primero, si no hay red usa Caché)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const path = new URL(event.request.url).pathname;
  if (path.startsWith('/proxy-script') || path.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
