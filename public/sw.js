// Tech Dispatch — Service Worker (PWA)
// • Caches the app shell so the installed app opens instantly and works offline
// • Network-first for the technician list, falling back to the last cached copy
const VERSION    = 'td-v2';
const SHELL      = 'td-shell-' + VERSION;
const DATA       = 'td-data-'  + VERSION;
const SHELL_URLS = [
  '/', '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/icon-maskable.png', '/apple-touch-icon.png',
];

// Pre-cache the shell on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(cache => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

// Drop old caches when a new version activates
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== SHELL && k !== DATA)
        .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache other API calls (auth, help, analytics, etc.) — always live
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/techs')) return;

  // Technician list: network-first, fall back to cached copy, then empty array
  if (url.pathname.startsWith('/api/techs')) {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(DATA).then(c => c.put(req, clone));
        return res;
      }).catch(() =>
        caches.match(req).then(cached =>
          cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } })
        )
      )
    );
    return;
  }

  // Navigations: network-first so updates show immediately, cached shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then(c => c || caches.match('/')))
    );
    return;
  }

  // Other same-origin GETs (built JS/CSS, icons): cache-first, then network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          const clone = res.clone();
          caches.open(SHELL).then(c => c.put(req, clone));
          return res;
        }).catch(() => cached)
      )
    );
  }
});
