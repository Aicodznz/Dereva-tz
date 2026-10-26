const CACHE_NAME = 'papo-hapo-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
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
  const url = new URL(e.request.url);
  // Avoid caching foreign API calls, dev source code, or non-GET requests
  if (
    e.request.method !== 'GET' || 
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }
  
  const isHtmlRequest = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  if (isHtmlRequest) {
    // Network-First strategy for HTML/navigation to guarantee the latest JS hash is loaded
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
          // Offline fallback
          return caches.match(e.request);
        })
    );
  } else {
    // Cache-First strategy for other static assets (images, CSS, JS, etc.)
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // Fallback or ignore
        });
      })
    );
  }
});

// ==========================================
// Comprehensive Web Push & Service Worker Notifications
// Supports: Lock Screen, Banners, Tray, Badges, Rich Images,
// Action Buttons (Kubali/Kataa), Grouped Stacks, Silent, and Progress.
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
    icon: data.icon || 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
    badge: data.badge || 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
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

// Interactive Clicks on Notifications & Action Buttons
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action; // 'accept', 'decline', 'view', 'reply', 'answer', or '' (body click)
  const data = event.notification.data || {};
  const targetUrl = data.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Broadcast notification click action to all active window clients
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

      // 2. Focus existing app window or open a new one
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

// Client Communication for Direct SW Notifications & Badges
self.addEventListener('message', (event) => {
  if (!event.data) return;

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


