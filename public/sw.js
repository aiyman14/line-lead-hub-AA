/// <reference lib="webworker" />

const CACHE_NAME = 'production-portal-v1';
const OFFLINE_QUEUE_KEY = 'offline_submission_queue';
const SYNC_TAG = 'sync-submissions';

// Static assets to cache (JS/CSS/icons only - no API data)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Patterns for resources we should NOT cache (sensitive data)
const NO_CACHE_PATTERNS = [
  /supabase/,
  /\/api\//,
  /\/auth\//,
  /\/rest\/v1\//,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Check if URL should not be cached (sensitive data)
function shouldNotCache(url) {
  return NO_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

// Fetch event - network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never cache sensitive API responses - always use network
  if (shouldNotCache(url)) {
    return;
  }

  // For static assets: cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        event.waitUntil(
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => {/* Network error, ignore */})
        );
        return cachedResponse;
      }

      // Network-first fallback
      return fetch(request).then((response) => {
        // Only cache static assets (not API responses)
        if (response.ok && response.type === 'basic' && !shouldNotCache(url)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

// Background sync for queued submissions
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processOfflineQueue());
  }
});

// Process offline queue
async function processOfflineQueue() {
  const queue = await getQueue();
  
  for (const submission of queue) {
    try {
      const response = await fetch(submission.endpoint, {
        method: submission.method,
        headers: {
          'Content-Type': 'application/json',
          ...submission.headers,
        },
        body: JSON.stringify(submission.body),
      });

      if (response.ok) {
        await removeFromQueue(submission.id);
        // Notify the client
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            id: submission.id,
          });
        });
      }
    } catch (error) {
      console.error('Sync failed for submission:', submission.id, error);
    }
  }
}

// Queue helpers using IndexedDB (more reliable in service worker)
function getQueue() {
  return new Promise((resolve) => {
    // For now, we'll use postMessage to get queue from main thread
    // In production, use IndexedDB directly
    resolve([]);
  });
}

function removeFromQueue(id) {
  return Promise.resolve();
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from Production Portal',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || [],
      tag: data.tag || 'default',
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Production Portal', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
