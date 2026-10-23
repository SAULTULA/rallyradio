const CACHE_NAME = 'radio-hits2o-v3';
const urlsToCache = [
  './index.html',
  './styles.css',
  './variables.css',
  './manifest.json'
];

self.addEventListener('install', event => {
  // Forza la actualización inmediata
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  // Borra cachés antiguas y toma el control de inmediato
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia: "Network First" (Red primero, si no hay red usa Caché)
self.addEventListener('fetch', event => {
  // Excluimos las peticiones que no sean GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonamos la respuesta y la actualizamos en caché
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
        // Si no hay red, servimos desde la caché
        return caches.match(event.request);
      })
  );
});
