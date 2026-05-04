/* ═══════════════════════════════════════════════
   SERVICE WORKER — obiDesk Intelligent Cache

   ┌─────────────────┬───────────────────────────┐
   │ Asset Type       │ Strategy                  │
   ├─────────────────┼───────────────────────────┤
   │ HTML (navigate)  │ Network-first, fallback   │
   │ CSS / JS         │ Stale-while-revalidate    │
   │ JSON data        │ Stale-while-revalidate    │
   │ .wasm modules    │ Cache-first (immutable)   │
   │ Fonts / images   │ Cache-first               │
   └─────────────────┴───────────────────────────┘
   ═══════════════════════════════════════════════ */

const CACHE = 'od-dev';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([
        './',
        './index.html',
        './browse.html',
        './desk.html',
        './get-listed.html',
        './request-system.html',
        './field.html',
        './offline.html',
        './css/base.css',
        './theme.js',
        './pwa.js',
        './js/app.js',
        './js/directory.js',
        './js/desk-page.js',
        './js/forms.js',
        './js/whatsapp.js',
        './js/idb.js',
        './js/field.js',
        './js/library.js',
        './data/categories.json',
        './data/areas.json',
      ]).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const path = url.pathname;

  if (req.mode === 'navigate' || path.endsWith('.html') || path.endsWith('/')) {
    e.respondWith(networkFirst(req));
  } else if (path.endsWith('.wasm')) {
    e.respondWith(cacheFirst(req));
  } else if (path.match(/\.(woff2?|ttf|otf|eot)$/)) {
    e.respondWith(cacheFirst(req));
  } else if (path.endsWith('.png') || path.endsWith('.ico') || path.endsWith('.svg') || path.endsWith('.webp')) {
    e.respondWith(cacheFirst(req));
  } else {
    e.respondWith(staleWhileRevalidate(req, true));
  }
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Offline fallback for navigation
    const offline = await caches.match('./offline.html');
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function staleWhileRevalidate(req, detectChanges) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then(async res => {
    if (!res.ok) return res;
    if (detectChanges && cached) {
      const oldEtag = cached.headers.get('etag');
      const newEtag = res.headers.get('etag');
      if (oldEtag && newEtag && oldEtag !== newEtag) {
        flagUpdate();
      }
    }
    cache.put(req, res.clone());
    return res;
  }).catch(() => {});

  if (cached) {
    fetchPromise;
    return cached;
  }

  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

function flagUpdate() {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'UPDATE_AVAILABLE' });
    });
  });
}

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
