'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const primaryNav = [
  { href: '/pos',     label: 'POS',    icon: '🛒' },
  { href: '/cocina',  label: 'Cocina', icon: '🍳' },
  { href: '/mesas',   label: 'Mesas',  icon: '🪑' },
  { href: '/carta',   label: 'Carta',  icon: '📋' },
]

const secondaryNav = [
  { href: '/inventario', label: 'Inventario', icon: '📦' },
  { href: '/caja',       label: 'Caja',       icon: '💰' },
  { href: '/compras',    label: 'Compras',    icon: '🛍️' },
  { href: '/clientes',   label: 'Clientes',   icon: '👥' },
  { href: '/facturas',   label: 'Facturas',   icon: '🧾' },
  { href: '/reportes',   label: 'Reportes',   icon: '📊' },
  { href: '/sucursales', label: 'Sucursales', icon: '🏪' },
  { href: '/ajustes',    label: 'Ajustes',    icon: '⚙️' },
]

export function MobileNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-up menu */}
      {menuOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden bg-sidebar border-t border-sidebar-border rounded-t-2xl shadow-2xl p-4">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
          <div className="grid grid-cols-4 gap-2">
            {secondaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <span className="text-2xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-sidebar border-t border-sidebar-border safe-area-bottom">
        <div className="flex items-stretch h-16">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 text-xs transition-colors',
                pathname.startsWith(item.href)
                  ? 'text-sidebar-accent-foreground bg-sidebar-accent'
                  : 'text-muted-foreground hover:text-sidebar-foreground'
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 flex-1 text-xs transition-colors',
              menuOpen
                ? 'text-sidebar-accent-foreground bg-sidebar-accent'
                : 'text-muted-foreground hover:text-sidebar-foreground'
            )}
          >
            <span className="text-xl">☰</span>
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  )
}
