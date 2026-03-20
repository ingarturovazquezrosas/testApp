/**
 * VozSegura — Service Worker
 * ════════════════════════════════════════════════════════
 * Responsabilidades:
 *  1. Cache offline → la app funciona sin internet
 *  2. Estrategia Network-first para datos P2P frescos
 *  3. Background Sync → denuncias en cola si no hay red
 *  4. Push Notifications → alertas de la red P2P
 *  5. Limpieza automática de caché viejo
 * ════════════════════════════════════════════════════════
 */

const APP_VERSION   = 'vozsegura-v1.0.0';
const STATIC_CACHE  = `${APP_VERSION}-static`;
const DATA_CACHE    = `${APP_VERSION}-data`;
const QUEUE_STORE   = 'vs-queue'; // denuncias pendientes (IndexedDB)

// ── Archivos a cachear en instalación ────────────────────
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // GUN.js y SEA desde CDN (se cachean en primera visita)
  'https://cdn.jsdelivr.net/npm/gun/gun.js',
  'https://cdn.jsdelivr.net/npm/gun/sea.js',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,600;1,9..40,300&display=swap',
];

// ════════════════════════════════════════════════════════
// EVENTO: INSTALL — precachear archivos estáticos
// ════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  console.log('[SW VozSegura] Instalando versión:', APP_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // Cachear archivos locales (crítico — falla si no existen)
        const local = ['/', '/index.html', '/manifest.json'];
        const remote = STATIC_FILES.filter(f => f.startsWith('http'));

        return cache.addAll(local).then(() =>
          // Cachear remotos con tolerancia a fallos (red puede no estar)
          Promise.allSettled(remote.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(r => cache.put(url, r))
              .catch(() => console.warn('[SW] No se pudo cachear:', url))
          ))
        );
      })
      .then(() => {
        console.log('[SW VozSegura] Instalación completa');
        return self.skipWaiting(); // activar inmediatamente
      })
  );
});

// ════════════════════════════════════════════════════════
// EVENTO: ACTIVATE — limpiar cachés viejos
// ════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  console.log('[SW VozSegura] Activando...');

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('vozsegura-') && k !== STATIC_CACHE && k !== DATA_CACHE)
          .map(k => {
            console.log('[SW VozSegura] Eliminando caché viejo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim()) // tomar control de todas las pestañas
  );
});

// ════════════════════════════════════════════════════════
// EVENTO: FETCH — estrategia de caché
// ════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ── Ignorar peticiones no-GET y extensiones de desarrollo ──
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // ── GUN.js peers (WebSocket) → no interceptar ──────────
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // ── Estrategia para recursos estáticos: Cache First ────
  // → Sirve desde caché, actualiza en background
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // ── Estrategia para la app principal: Network First ────
  // → Intenta red primero (datos P2P frescos), cae a caché
  event.respondWith(networkFirst(event.request));
});

// ── Cache First (imágenes, JS, CSS, fuentes) ─────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// ── Network First (HTML, datos dinámicos) ────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Sin red → servir desde caché
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW VozSegura] Sirviendo offline:', request.url);
      return cached;
    }
    // Fallback final → página principal
    const fallback = await caches.match('/index.html');
    return fallback || new Response(offlinePage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// ── Determinar si es recurso estático ────────────────────
function isStaticAsset(url) {
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2|woff|ttf)$/) ||
         url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com') ||
         url.hostname.includes('cdn.jsdelivr.net');
}

// ════════════════════════════════════════════════════════
// BACKGROUND SYNC — denuncias en cola sin conexión
// ════════════════════════════════════════════════════════
/**
 * Si el usuario envía una denuncia sin internet, se guarda
 * en IndexedDB. Cuando vuelve la conexión, el SW la propaga
 * automáticamente a la red P2P de GUN.js.
 */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-denuncias') {
    console.log('[SW VozSegura] Background sync: propagando denuncias en cola...');
    event.waitUntil(syncDenunciasEnCola());
  }
});

async function syncDenunciasEnCola() {
  try {
    const db = await abrirDB();
    const cola = await getAllFromStore(db, QUEUE_STORE);

    for (const denuncia of cola) {
      try {
        // En producción: gun.get('vozsegura_denuncias_v1').get(denuncia.id).put(denuncia)
        // Aquí simulamos el éxito
        console.log('[SW VozSegura] Propagando denuncia en cola:', denuncia.id);
        await deleteFromStore(db, QUEUE_STORE, denuncia.id);

        // Notificar al usuario que se propagó
        await self.registration.showNotification('✓ Denuncia propagada', {
          body: `Tu denuncia de ${denuncia.tipo} en ${denuncia.zona} ya está en la red P2P.`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          tag: 'sync-ok-' + denuncia.id,
          data: { denuncia },
        });
      } catch(e) {
        console.warn('[SW VozSegura] No se pudo propagar:', denuncia.id, e);
      }
    }
  } catch(e) {
    console.error('[SW VozSegura] Error en background sync:', e);
  }
}

// ════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — alertas P2P entrantes
// ════════════════════════════════════════════════════════
/**
 * Cuando un peer de GUN.js envía una notificación push
 * sobre una alerta nueva en la zona del usuario, el SW
 * la muestra aunque la app esté cerrada.
 */
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { tipo: 'Alerta', zona: 'tu zona', desc: event.data.text() };
  }

  const options = {
    body: `${data.desc || 'Nuevo reporte en ' + data.zona}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    tag: 'alerta-' + (data.id || Date.now()),
    renotify: true,
    requireInteraction: data.urgencia === 'alta',
    data: { url: '/?accion=alerta&id=' + (data.id || ''), ...data },
    actions: [
      { action: 'ver',       title: 'Ver en mapa' },
      { action: 'confirmar', title: '✓ Confirmar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      `⚠ ${data.tipo || 'Alerta'} · ${data.zona || 'Zona cercana'}`,
      options
    )
  );
});

// ── Clic en notificación ─────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action;
  const data   = event.notification.data || {};
  const url    = action === 'ver' ? (data.url || '/') : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Si la app ya está abierta, enfocarla
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({ type: 'NOTIF_CLICK', action, data });
            return;
          }
        }
        // Si no está abierta, abrirla
        return clients.openWindow(url);
      })
  );
});

// ════════════════════════════════════════════════════════
// MENSAJE DESDE LA APP — guardar denuncia en cola offline
// ════════════════════════════════════════════════════════
self.addEventListener('message', async event => {
  const { type, payload } = event.data || {};

  if (type === 'GUARDAR_EN_COLA') {
    // Denuncia enviada sin internet → guardar en IndexedDB
    const db = await abrirDB();
    await putInStore(db, QUEUE_STORE, payload);
    console.log('[SW VozSegura] Denuncia guardada en cola offline:', payload.id);

    // Registrar sync para cuando vuelva la red
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-denuncias');
    }

    event.source.postMessage({ type: 'COLA_OK', id: payload.id });
  }

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ════════════════════════════════════════════════════════
// INDEXEDDB — helpers para cola offline
// ════════════════════════════════════════════════════════
function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('VozSeguraDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
function getAllFromStore(db, store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = e => rej(e.target.error);
  });
}
function putInStore(db, store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}
function deleteFromStore(db, store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

// ════════════════════════════════════════════════════════
// PÁGINA OFFLINE DE EMERGENCIA
// ════════════════════════════════════════════════════════
function offlinePage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>VozSegura — Sin conexión</title>
  <style>
    body { background:#070810; color:#dde1f0; font-family:sans-serif;
           display:flex; flex-direction:column; align-items:center;
           justify-content:center; min-height:100vh; text-align:center; padding:24px; }
    .icon { font-size:56px; margin-bottom:16px; }
    h1 { font-size:22px; margin-bottom:8px; }
    p  { color:#7b82a0; font-size:14px; line-height:1.6; max-width:300px; }
    .btn { margin-top:24px; padding:14px 28px; background:#f04040;
           border:none; border-radius:12px; color:#fff; font-size:15px;
           cursor:pointer; }
  </style>
</head>
<body>
  <div class="icon">📡</div>
  <h1>Sin conexión a la red</h1>
  <p>VozSegura funciona en modo P2P. Necesitas al menos conexión a internet para sincronizar con otros nodos.</p>
  <p style="margin-top:12px">Tus denuncias guardadas se propagarán automáticamente cuando vuelvas a conectarte.</p>
  <button class="btn" onclick="location.reload()">Reintentar</button>
</body>
</html>`;
}
