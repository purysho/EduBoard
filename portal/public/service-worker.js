// Caches the app shell only (this file's own HTML/manifest/icon) so the page can load
// at all when offline — API data is deliberately NOT cached here. That happens in
// index.html's own api() function instead, via the page's own Cache Storage access,
// because only the page can tell the difference between "served fresh" and "served
// from cache" and show an honest "last synced" banner; a service worker serving stale
// JSON silently would hide that from the student.
const SHELL_CACHE = 'eduboard-shell-v1'
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
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Never intercept API calls or anything cross-origin (Google Fonts, etc.) — only the
  // handful of same-origin shell files this service worker owns.
  if (event.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, res.clone()))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
