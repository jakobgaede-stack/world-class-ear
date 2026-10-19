// Service Worker: Samples, Choräle und Code offline verfügbar halten.
const VERSION = 'wce-v3';
const CORE = ['./', './index.html', './css/app.css', './js/main.js', './vendor/vexflow-bravura.js', './assets/samples/manifest.json', './assets/chorales/index.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isJson = url.pathname.endsWith('.json');
  const isAsset = !isJson && (url.pathname.includes('/assets/') || url.pathname.includes('/vendor/'));
  if (isAsset) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok && !res.redirected) c.put(e.request, res.clone());
      return res;
    }));
  } else {
    e.respondWith(fetch(e.request).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone())); return res; }).catch(() => caches.match(e.request)));
  }
});
