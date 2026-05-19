import { notFound } from 'next/navigation'
import { getMenuPublico } from '@/lib/queries/productos'
import type { Metadata } from 'next'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getMenuPublico(slug)
  if (!data) return { title: 'Menú no encontrado' }
  return { title: `Carta – ${data.tenant.nombre}`, description: `Menú de ${data.tenant.nombre}` }
}

export default async function MenuPage({ params }: Props) {
  const { slug } = await params
  const data = await getMenuPublico(slug)
  if (!data) notFound()

  const { tenant, categorias } = data

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {tenant.logo_url && (
            <img src={tenant.logo_url} alt={tenant.nombre} className="w-10 h-10 rounded-full object-cover" />
          )}
          <h1 className="text-white font-bold text-xl">{tenant.nombre}</h1>
        </div>
        {/* Navegación por categorías */}
        <div className="max-w-2xl mx-auto mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categorias?.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="shrink-0 px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:text-white text-sm transition-colors"
            >
              {cat.nombre}
            </a>
          ))}
        </div>
      </div>

      {/* Menú */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-10">
        {categorias?.map((cat) => {
          const productos = (cat as { productos?: unknown[] }).productos ?? []
          if (productos.length === 0) return null

          return (
            <section key={cat.id} id={`cat-${cat.id}`}>
              <h2 className="text-white font-bold text-lg mb-4 border-b border-slate-800 pb-2">
                {cat.nombre}
              </h2>
              <div className="space-y-3">
                {(productos as Array<{
                  id: string
                  nombre: string
                  descripcion: string | null
                  imagen_url: string | null
                  precio_salon: number
                  precio_llevar: number | null
                  activo: boolean
                }>)
                  .filter((p) => p.activo)
                  .map((producto) => (
                    <div
                      key={producto.id}
                      className="flex gap-4 bg-slate-900 rounded-xl p-4 border border-slate-800"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium">{producto.nombre}</h3>
                        {producto.descripcion && (
                          <p className="text-slate-400 text-sm mt-0.5 leading-relaxed">
                            {producto.descripcion}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-emerald-400 font-bold">
                            S/ {producto.precio_salon.toFixed(2)}
                          </span>
                          {producto.precio_llevar && producto.precio_llevar !== producto.precio_salon && (
                            <span className="text-slate-400 text-xs">
                              Para llevar: S/ {producto.precio_llevar.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      {producto.imagen_url && (
                        <img
                          src={producto.imagen_url}
                          alt={producto.nombre}
                          className="w-20 h-20 object-cover rounded-lg shrink-0"
                        />
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 py-3 px-4 text-center">
        <p className="text-slate-500 text-xs">
          Powered by <span className="text-slate-300">RestaurantOS</span>
        </p>
      </div>
    </div>
  )
}
