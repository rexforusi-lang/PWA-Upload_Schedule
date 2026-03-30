
const CACHE_NAME = 'drive-share-hub-v0.1';
const APP_ASSETS = ['./','index.html','app.css','app.js','manifest.json','offline.html','icon-192.png','icon-512.png'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil((async()=>{ const keys = await caches.keys(); await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))); await self.clients.claim(); })()); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;
  if(event.request.mode === 'navigate'){
    event.respondWith((async()=>{ try{ const fresh = await fetch(event.request); const cache = await caches.open(CACHE_NAME); cache.put('index.html', fresh.clone()); return fresh; }catch(_e){ return (await caches.match(event.request)) || caches.match('offline.html'); } })());
    return;
  }
  event.respondWith((async()=>{ const cached = await caches.match(event.request); if(cached) return cached; try{ const fresh = await fetch(event.request); if(event.request.method === 'GET'){ const cache = await caches.open(CACHE_NAME); cache.put(event.request, fresh.clone()); } return fresh; }catch(_e){ return caches.match('offline.html'); } })());
});
