'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/pos', label: 'POS', icon: '🛒' },
  { href: '/cocina', label: 'Cocina', icon: '🍳' },
  { href: '/mesas', label: 'Mesas', icon: '🪑' },
  { href: '/carta', label: 'Carta', icon: '📋' },
  { href: '/inventario', label: 'Inventario', icon: '📦' },
  { href: '/caja', label: 'Caja', icon: '💰' },
  { href: '/compras', label: 'Compras', icon: '🛍️' },
  { href: '/clientes', label: 'Clientes', icon: '👥' },
  { href: '/reportes', label: 'Reportes', icon: '📊' },
  { href: '/ajustes', label: 'Ajustes', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-16 md:w-56 min-h-screen bg-slate-900 border-r border-slate-800 shrink-0">
      <div className="px-3 py-4 border-b border-slate-800">
        <span className="hidden md:block text-white font-bold text-lg">RestaurantOS</span>
        <span className="md:hidden text-white font-bold text-xl text-center block">🍽️</span>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <span className="text-lg shrink-0">{item.icon}</span>
            <span className="hidden md:block">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors"
        >
          <span className="text-lg">🚪</span>
          <span className="hidden md:block">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
