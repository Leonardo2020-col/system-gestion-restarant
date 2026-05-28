'use client'
import { useState } from 'react'
import { usePosStore } from '@/stores/pos.store'
import { Badge } from '@/components/ui/badge'
import type { Categoria } from '@/types/supabase'
import type { ProductoConCategoria } from '@/lib/queries/productos'

type Props = {
  categorias: Categoria[]
  productos: ProductoConCategoria[]
}

export function ProductGrid({ categorias, productos }: Props) {
  const [catId, setCatId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { addItem } = usePosStore()

  const filtered = productos.filter((p) => {
    const matchCat = catId ? p.categoria_id === catId : true
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="flex flex-col h-full gap-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar producto..."
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCatId(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            catId === null
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCatId(cat.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              catId === cat.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((producto) => (
            <button
              key={producto.id}
              onClick={() => addItem({ id: producto.id, nombre: producto.nombre, precio_salon: producto.precio_salon })}
              className="flex flex-col bg-card hover:bg-muted rounded-xl p-3 text-left transition-colors border border-border hover:border-border"
            >
              {producto.imagen_url ? (
                <img
                  src={producto.imagen_url}
                  alt={producto.nombre}
                  className="w-full aspect-square object-cover rounded-lg mb-2"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center mb-2 text-2xl">
                  🍽️
                </div>
              )}
              <span className="text-foreground text-sm font-medium leading-tight">{producto.nombre}</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold mt-1">
                S/ {Number(producto.precio_salon).toFixed(2)}
              </span>
              {producto.categoria && (
                <Badge variant="outline" className="mt-1 text-xs w-fit">
                  {producto.categoria.nombre}
                </Badge>
              )}
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-muted-foreground text-center py-12">Sin productos</div>
        )}
      </div>
    </div>
  )
}
