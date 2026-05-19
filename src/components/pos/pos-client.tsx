'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { usePosStore } from '@/stores/pos.store'
import { MesaGrid } from './mesa-grid'
import { ProductGrid } from './product-grid'
import { Cart } from './cart'
import type { Salon, Categoria } from '@/types/supabase'
import type { MesaConSalon } from '@/lib/queries/mesas'
import type { ProductoConCategoria } from '@/lib/queries/productos'

type Props = {
  mesas: MesaConSalon[]
  salones: Salon[]
  categorias: Categoria[]
  productos: ProductoConCategoria[]
  tenantId: string
  usuarioId: string
}

export function PosClient({ mesas, salones, categorias, productos, tenantId, usuarioId }: Props) {
  const router = useRouter()
  const { mesaId, setMesa, cart, clearCart, total, tipoPedido } = usePosStore()
  const [view, setView] = useState<'mesas' | 'productos'>('mesas')
  const [submitting, setSubmitting] = useState(false)

  function selectMesa(id: string) {
    setMesa(id)
    setView('productos')
  }

  async function enviarPedido() {
    if (cart.length === 0) {
      toast.error('El carrito está vacío')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          usuario_id: usuarioId,
          mesa_id: mesaId,
          tipo: tipoPedido,
          total: total(),
          items: cart.map((i) => ({
            producto_id: i.producto.id,
            cantidad: i.cantidad,
            precio_unit: i.producto.precio_salon,
            notas: i.notas,
          })),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Pedido enviado a cocina')
      clearCart()
      setView('mesas')
      router.refresh()
    } catch {
      toast.error('Error al enviar el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView('mesas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'mesas'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Mesas {mesaId && `(Mesa ${mesas.find((m) => m.id === mesaId)?.numero ?? ''})`}
          </button>
          <button
            onClick={() => setView('productos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'productos'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Productos
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {view === 'mesas' ? (
            <MesaGrid mesas={mesas} salones={salones} selectedId={mesaId} onSelect={selectMesa} />
          ) : (
            <ProductGrid categorias={categorias} productos={productos} />
          )}
        </div>
      </div>

      <div className="w-80 shrink-0">
        <Cart onEnviar={enviarPedido} submitting={submitting} />
      </div>
    </div>
  )
}
