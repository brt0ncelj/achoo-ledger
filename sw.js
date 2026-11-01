// Offline cache for Achoo Ledger. Bump VERSION when files change.
const VERSION = 'achoo-v4';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // Sheet sync goes straight to network
  if (req.mode === 'navigate') {
    // Try the network briefly so updates arrive; fall back to the cached app offline.
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const net = await Promise.race([fetch(req), new Promise((_, r) => setTimeout(r, 2500))]);
        if (net && net.ok) { cache.put('./index.html', net.clone()); return net; }
      } catch (_) {}
      return (await cache.match('./index.html')) || (await cache.match('./')) || fetch(req);
    })());
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
