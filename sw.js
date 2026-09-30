const DEPLOYMENT_ID = '__AVA_DEPLOYMENT_ID__';
const CACHE_PREFIX = 'ava-saving-phase1-shell-';
const LEGACY_CACHES = ['ava-saving-phase1-v2', 'ava-saving-phase1-20260930-p6-rail-v1'];
const CACHE = `${CACHE_PREFIX}${DEPLOYMENT_ID}`;
const SHELL = ['./', './index.html', './styles.css', './manifest.webmanifest', './icon.svg', './src/main.js', './src/build.js', './src/calculation.js', './src/data.js', './src/state.js', './src/views.js', './src/media.js', './src/pdf.js', './src/portable.js', './src/integration.js', './src/admin.js'];

self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
));

self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => (LEGACY_CACHES.includes(key) || key.startsWith(CACHE_PREFIX)) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

async function cacheResponse(request, response) {
  if (!response || !response.ok || new URL(request.url).origin !== self.location.origin) return response;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
  return response;
}

async function navigationResponse(request) {
  try {
    // The document is the update signal. Never let an old cached index.html
    // permanently mask a successful deployment.
    return await cacheResponse(request, await fetch(request, { cache: 'no-store' }));
  } catch {
    return (await caches.match(request)) || (await caches.match('./index.html'));
  }
}

async function sameOriginResponse(request) {
  try {
    return await cacheResponse(request, await fetch(request, { cache: 'no-store' }));
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Saving resource unavailable while offline');
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(event.request.mode === 'navigate' ? navigationResponse(event.request) : sameOriginResponse(event.request));
});
