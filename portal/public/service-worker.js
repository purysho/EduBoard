// Caches the app shell only (this file's own HTML/manifest/icon) so the page can load
// at all when offline — API data is deliberately NOT cached here. That happens in
// index.html's own api() function instead, via the page's own Cache Storage access,
// because only the page can tell the difference between "served fresh" and "served
// from cache" and show an honest "last synced" banner; a service worker serving stale
// JSON silently would hide that from the student.
// Bump when the shell's behaviour changes; activate() deletes every other cache name.
const SHELL_CACHE = 'eduboard-shell-v2'
const SHELL_ASSETS = ['/', '/manifest.json', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Old shell versions only. The page's own API cache (eduboard-api-*) holds
            // the student's offline data and is the page's to manage.
            .filter((k) => k.startsWith('eduboard-shell-') && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Never intercept API calls or anything cross-origin — only the
  // handful of same-origin shell files this service worker owns.
  if (event.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Network first, cache only as the offline fallback. Cache-first would hand returning
  // students the previous version of the page after every update (and old page code
  // talking to a newer server) until a second reload.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy))
        }
        return res
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  )
})
