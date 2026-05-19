import { createClient } from '@/lib/supabase/server'
import { getCategorias, getProductosActivos } from '@/lib/queries/productos'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Usuario } from '@/types/supabase'

export default async function CartaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: raw } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = raw as Usuario | null
  if (!usuario) return null

  const [categorias, productos] = await Promise.all([
    getCategorias(usuario.tenant_id),
    getProductosActivos(usuario.tenant_id),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Carta</h1>
        <div className="flex gap-2">
          <Badge className="bg-slate-700 text-slate-300">{categorias.length} categorías</Badge>
          <Badge className="bg-slate-700 text-slate-300">{productos.length} productos</Badge>
        </div>
      </div>

      {categorias.map((cat) => {
        const prods = productos.filter((p) => p.categoria_id === cat.id)
        return (
          <div key={cat.id}>
            <h3 className="text-slate-300 font-semibold mb-3 flex items-center gap-2">
              {cat.nombre}
              <Badge variant="outline" className="border-slate-700 text-slate-500 text-xs">
                {cat.area_produccion}
              </Badge>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {prods.map((p) => (
                <Card key={p.id} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-3 flex gap-3">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center text-2xl shrink-0">🍽️</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{p.nombre}</p>
                      {p.descripcion && (
                        <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{p.descripcion}</p>
                      )}
                      <p className="text-emerald-400 font-bold text-sm mt-1">
                        S/ {p.precio_salon.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}

      {productos.length === 0 && (
        <div className="text-slate-500 text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p>Sin productos. Agrega categorías y productos desde Ajustes.</p>
        </div>
      )}
    </div>
  )
}
