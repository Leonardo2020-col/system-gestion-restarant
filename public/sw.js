const CACHE_NAME = 'restaurantos-v2'
const STATIC_ASSETS = [
  '/',
  '/pos',
  '/cocina',
  '/mesas',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  // Skip Supabase API calls — always network
  if (event.request.url.includes('supabase.co')) return
  // Skip Next.js internal routes
  if (event.request.url.includes('/_next/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
    return
  }

  // Cache-first for static assets, network-first for pages
  const isStaticAsset =
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    event.request.url.includes('/icons/') ||
    event.request.url.includes('/manifest.json')

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return res
        })
      )
    )
  } else {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    )
  }
})
