/* انیمه ۵۰۰ — پوستهٔ آفلاین */
const VERSION = 'anime500-v1';
const SHELL = [
  './', './index.html', './anime.css', './anime.js', './anime-data.js',
  './favicon.svg', './manifest.webmanifest', '../fonts/Vazirmatn-Variable.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(SHELL.map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    }));
    if (self.skipWaiting) await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)));
    if (self.clients && self.clients.claim) await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', network.clone()).catch(() => {});
        return network;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match('./index.html', { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request).then(response => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
