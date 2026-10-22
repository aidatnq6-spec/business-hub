const CACHE_PREFIX = 'business-hub-';
const CACHE_NAME = CACHE_PREFIX + 'v19';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];
const SCRIPT_HOSTS = new Set(['www.gstatic.com', 'cdn.jsdelivr.net']);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const navigation = sameOrigin && event.request.mode === 'navigate';
  const shell = sameOrigin && APP_SHELL.includes(url.pathname);
  const script = event.request.destination === 'script' && SCRIPT_HOSTS.has(url.hostname);
  if (!navigation && !shell && !script) return;

  const network = fetch(event.request);
  event.waitUntil(network.then(async response => {
    if (response.ok && response.type !== 'opaque') {
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(navigation ? '/' : event.request, copy);
    }
  }).catch(() => {}));
  event.respondWith(network.catch(async () => {
    const cached = await caches.match(event.request, { cacheName:CACHE_NAME });
    if (cached) return cached;
    if (navigation) {
      const page = await caches.match('/', { cacheName:CACHE_NAME });
      if (page) return page;
    }
    return Response.error();
  }));
});
