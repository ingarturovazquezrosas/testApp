// ═══════════════════════════════════════════════
//  ALERTA MX — Service Worker
//  Habilita: instalación como PWA, offline support,
//            cache de recursos estáticos.
// ═══════════════════════════════════════════════

const CACHE_NAME = 'alerta-mx-v1.0.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap'
];

// ── INSTALL: pre-cache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS.filter(u => !u.startsWith('http'))))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clear old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for static, network-first for tiles ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Map tiles: network with cache fallback
  if (url.hostname.includes('basemaps.cartocdn.com') || url.hostname.includes('tile.openstreetmap')) {
    event.respondWith(
      caches.open(CACHE_NAME + '-tiles').then(cache =>
        fetch(event.request)
          .then(response => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cache.match(event.request))
      )
    );
    return;
  }

  // CDN assets: cache-first
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        })
      )
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => caches.match('./index.html'))
  );
});

// ── BACKGROUND SYNC: sync alerts when back online ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-alerts') {
    event.waitUntil(syncAlerts());
  }
});

async function syncAlerts() {
  // In production: push pending offline alerts to P2P network
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'sync-complete', ts: Date.now() });
  });
}

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = '🚨 Alerta MX — ' + (data.tipo || 'Nueva alerta');
  const options = {
    body: data.desc || 'Nueva alerta de seguridad en tu zona',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'alerta-' + Date.now(),
    data: { url: './#map' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'view', title: '📍 Ver en mapa' },
      { action: 'dismiss', title: 'Ignorar' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'view') {
    event.waitUntil(clients.openWindow('./#map'));
  }
});
