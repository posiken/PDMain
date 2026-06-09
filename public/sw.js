// Trouble-Call Dispatch — Service Worker
// Caches the technician list so the lookup page works when offline.
const CACHE = 'dispatch-v1';

// Cache the /api/techs response on every successful fetch.
// Fall back to the cached version when offline.
self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (url.includes('/api/techs') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Save a fresh copy in the cache
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          // Offline: serve the last cached tech list
          caches.match(event.request).then(cached =>
            cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } })
          )
        )
    );
  }
});

// Clean up old caches when a new version of the SW activates
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});
