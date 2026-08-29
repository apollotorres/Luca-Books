// Self-destroying Service Worker to immediately release any active browser tabs
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    self.registration.unregister().then(() => {
      return caches.keys();
    }).then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach(c => c.navigate(c.url));
    })
  );
});

// Pass through all network traffic without interception
self.addEventListener('fetch', (e) => {});
