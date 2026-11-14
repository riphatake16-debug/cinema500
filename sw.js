/* Cinema500 offline shell. Fresh catalogue stays network-first; artwork is cached on demand. */
const VERSION = 'cinema500-v10';
const SHELL = [
  './', './index.html', './privacy.html', './terms.html',
  './app.js', './catalogue.js', './live.js', './discovery.js', './ranks.js',
  './roulette.js', './selects.js', './motion.js', './sw-register.js',
  './style.css', './mobile.css', './favicon.svg', './manifest.webmanifest',
  './fonts/Vazirmatn-Variable.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
const SHELL_CACHE = VERSION + '-shell';
const MEDIA_CACHE = VERSION + '-media';
const MEDIA_LIMIT = 260;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    }));
    if (self.skipWaiting) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
    if (self.clients && self.clients.claim) await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting' && self.skipWaiting) self.skipWaiting();
});

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMedia(url) {
  return /\.(?:jpg|jpeg|png|webp|avif|svg)$/i.test(url.pathname);
}

async function trimMedia(cache) {
  const keys = await cache.keys();
  if (keys.length <= MEDIA_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - MEDIA_LIMIT).map((request) => cache.delete(request)));
}

async function networkFirst(request, cacheName, ms) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  try {
    const network = ms ? await Promise.race([fetch(request), timeout(ms).then(() => null)]) : await fetch(request);
    if (network && network.ok) {
      cache.put(request, network.clone()).catch(() => {});
      return network;
    }
    return cached || (network ? network : Response.error());
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request).then(async (response) => {
    if (response && response.ok) {
      await cache.put(request, response.clone());
      if (cacheName === MEDIA_CACHE) await trimMedia(cache);
    }
    return response;
  }).catch(() => null);
  if (cached) {
    update.catch(() => {});
    return cached;
  }
  const network = await update;
  if (network) return network;
  return (await cache.match(request, { ignoreSearch: true })) || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const network = await fetch(request).catch(() => null);
  if (network && network.ok) {
    await cache.put(request, network.clone());
    await trimMedia(cache);
  }
  return network || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        if (network && network.ok) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put('./index.html', network.clone()).catch(() => {});
        }
        return network;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./index.html', { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) {
    if (url.hostname.endsWith('media-amazon.com') || url.hostname === 'images.metahub.space') {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  if (/live-catalogue\.json$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, SHELL_CACHE, 4000));
    return;
  }

  if (isMedia(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
