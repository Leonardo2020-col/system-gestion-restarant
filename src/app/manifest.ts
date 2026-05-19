import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RestaurantOS',
    short_name: 'RestOS',
    description: 'Sistema de gestión para restaurantes',
    start_url: '/pos',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#0f172a',
    background_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
