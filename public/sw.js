// Service worker for the installable app (owner, 2026-10-30).
// Pages are always fetched from the network (so nothing is ever stale); if the network is down, /offline is shown.
// Hashed static files and images are cached after first use. Nothing from /api or Supabase is ever cached.
// Bump when a file under /images or /icons changes in place (v2: new logo, owner 2026-10-30), so phones drop the old copy.
const VERSION = 'barp-v2';
const SHELL = ['/offline', '/icons/icon-192.png', '/images/barp-logo-mark.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline')));
    return;
  }
  const isStatic = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/') || url.pathname.startsWith('/members/');
  if (!isStatic) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
