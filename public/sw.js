const CACHE_NAME = 'papo-hapo-v6';
const MAP_TILE_CACHE = 'papo-map-tiles-v1';
const MAP_STYLE_CACHE = 'papo-map-styles-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/maplibre-gl-worker.mjs',
  '/brand/app-icon.png',
  '/brand/logo-full.png',
  '/brand/whatsapp-badge.png',
];

let forceOfflineMode = false;

function isMapTileUrl(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (
    host.endsWith('tile.openstreetmap.org') ||
    host.endsWith('tile.openstreetmap.fr') ||
    host.includes('basemaps.cartocdn.com') ||
    host.includes('tiles.stadiamaps.com') ||
    (host.endsWith('.google.com') && path.includes('/vt/')) ||
    (host === 'server.arcgisonline.com' && path.includes('/tile/'))
  ) {
    return true;
  }

  if (
    host === 'tiles.openfreemap.org' &&
    (path.endsWith('.pbf') || path.includes('/planet/'))
  ) {
    return true;
  }

  if (
    host === 'api.mapbox.com' &&
    (path.includes('/v4/') || path.includes('/tiles/') || path.includes('/raster'))
  ) {
    return true;
  }

  return false;
}

function isMapStyleOrAssetUrl(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (path === '/maplibre-gl-worker.mjs') return true;

  if (host === 'tiles.openfreemap.org') {
    return true;
  }

  if (
    host === 'api.mapbox.com' &&
    (path.includes('/styles/') || path.includes('/fonts/') || path.includes('/sprites'))
  ) {
    return true;
  }

  return false;
}

function shouldBypassCompletely(request, url) {
  if (request.method !== 'GET') return true;

  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (
    host.includes('firestore.googleapis.com') ||
    host.includes('identitytoolkit.googleapis.com') ||
    host.includes('securetoken.googleapis.com') ||
    host.includes('firebase') ||
    host.includes('cloudinary.com')
  ) {
    return true;
  }

  if (
    path.startsWith('/api/') ||
    path.startsWith('/src/') ||
    path.startsWith('/@') ||
    path.includes('node_modules') ||
    path.endsWith('.tsx') ||
    path.endsWith('.ts')
  ) {
    return true;
  }

  return false;
}

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate Event (preserve user-downloaded offline map caches!)
self.addEventListener('activate', (e) => {
  const keepCaches = new Set([CACHE_NAME, MAP_TILE_CACHE, MAP_STYLE_CACHE]);
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!keepCaches.has(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  let url;
  try {
    url = new URL(e.request.url);
  } catch {
    return;
  }

  if (shouldBypassCompletely(e.request, url)) {
    return;
  }

  // 1. 2D & 3D Map Tiles (Cache-First, supports CORS & opaque Google/OSM responses)
  if (isMapTileUrl(url)) {
    e.respondWith(
      caches.open(MAP_TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request, { ignoreVary: true });
        if (cached) return cached;

        if (forceOfflineMode || !self.navigator.onLine) {
          return new Response('', { status: 504, statusText: 'Offline Tile Miss' });
        }

        try {
          const networkResponse = await fetch(e.request);
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            cache.put(e.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline Tile Miss' });
        }
      })
    );
    return;
  }

  // 2. 3D Map Styles, TileJSON, Sprites, Glyphs & Worker
  if (isMapStyleOrAssetUrl(url)) {
    e.respondWith(
      caches.open(MAP_STYLE_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request, { ignoreVary: true });
        if (cached) return cached;

        if (forceOfflineMode || !self.navigator.onLine) {
          return new Response('', { status: 504, statusText: 'Offline Style Miss' });
        }

        try {
          const networkResponse = await fetch(e.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(e.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline Style Miss' });
        }
      })
    );
    return;
  }

  const isHtmlRequest =
    e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  if (isHtmlRequest) {
    // Network-First for HTML/navigation so latest app bundle is always served online
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(e.request).then((m) => m || caches.match('/index.html'));
        })
    );
  } else if (url.origin === self.location.origin) {
    // Network-first with cache fallback for built same-origin JS/CSS/images
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(e.request);
        })
    );
  }
});

// ==========================================
// Comprehensive Web Push & Service Worker Notifications
// ==========================================

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Papo Hapo', body: event.data.text() };
    }
  }

  const title = data.title || 'Papo Hapo';
  const options = {
    body: data.body || 'Una taarifa mpya kutoka Papo Hapo',
    icon: data.icon || '/brand/app-icon.png',
    badge: data.badge || '/brand/whatsapp-badge.png',
    image: data.image || undefined,
    tag: data.tag || 'papopay_general',
    data: data.data || { url: data.url || '/notifications' },
    actions: data.actions || [],
    vibrate: data.vibrate !== undefined ? data.vibrate : [200, 100, 200],
    silent: Boolean(data.silent),
    requireInteraction: Boolean(data.requireInteraction),
    renotify: Boolean(data.renotify),
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      if (typeof data.badgeCount === 'number' && 'setAppBadge' in navigator) {
        return navigator.setAppBadge(data.badgeCount).catch(() => {});
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};
  const targetUrl = data.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_ACTION',
          action: action || 'click',
          tag: event.notification.tag,
          data: data,
          title: event.notification.title,
        });

        if (data.callId) {
          client.postMessage({
            type: 'NOTIFICATION_CALL_ACTION',
            action: action || 'open',
            callId: data.callId,
            callData: data,
          });
        }
      });

      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATION_CLOSED',
        tag: event.notification.tag,
        callId: data.callId,
      });
    });
  });
});

// Client Communication for Notifications, Badges & Offline Map Controls
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SET_FORCE_OFFLINE') {
    forceOfflineMode = Boolean(event.data.value);
    return;
  }

  if (event.data.type === 'CLEAR_MAP_CACHE') {
    Promise.all([caches.delete(MAP_TILE_CACHE), caches.delete(MAP_STYLE_CACHE)]).catch(() => {});
    return;
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options).catch((err) => {
      console.warn('[SW] showNotification error:', err);
    });
  }

  if (event.data.type === 'SET_APP_BADGE' && 'setAppBadge' in navigator) {
    navigator.setAppBadge(event.data.count || 0).catch(() => {});
  }

  if (event.data.type === 'CLEAR_APP_BADGE' && 'clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
});
