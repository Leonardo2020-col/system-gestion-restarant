'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/pos',        label: 'POS',        icon: '🛒' },
  { href: '/cocina',     label: 'Cocina',      icon: '🍳' },
  { href: '/mesas',      label: 'Mesas',       icon: '🪑' },
  { href: '/carta',      label: 'Carta',       icon: '📋' },
  { href: '/inventario', label: 'Inventario',  icon: '📦' },
  { href: '/caja',       label: 'Caja',        icon: '💰' },
  { href: '/compras',    label: 'Compras',     icon: '🛍️' },
  { href: '/clientes',   label: 'Clientes',    icon: '👥' },
  { href: '/facturas',   label: 'Facturas',    icon: '🧾' },
  { href: '/reportes',   label: 'Reportes',    icon: '📊' },
  { href: '/sucursales', label: 'Sucursales',  icon: '🏪' },
  { href: '/ajustes',    label: 'Ajustes',     icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggle } = useTheme()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-16 md:w-56 min-h-screen bg-sidebar border-r border-sidebar-border shrink-0">
      <div className="px-3 py-4 border-b border-sidebar-border">
        <span className="hidden md:block text-sidebar-foreground font-bold text-lg">RestaurantOS</span>
        <span className="md:hidden text-sidebar-foreground font-bold text-xl text-center block">🍽️</span>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
            )}
          >
            <span className="text-lg shrink-0">{item.icon}</span>
            <span className="hidden md:block">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm transition-colors"
        >
          <span className="text-lg shrink-0">{theme === 'light' ? '🌙' : '☀️'}</span>
          <span className="hidden md:block">{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
        </button>
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm transition-colors"
        >
          <span className="text-lg">🚪</span>
          <span className="hidden md:block">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
