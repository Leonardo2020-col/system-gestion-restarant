'use client'
import { usePosStore } from '@/stores/pos.store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

type Props = {
  onEnviar: () => void
  submitting: boolean
}

export function Cart({ onEnviar, submitting }: Props) {
  const { cart, updateCantidad, removeItem, total, clearCart, tipoPedido, setTipo } = usePosStore()

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="text-foreground font-semibold">Pedido</h2>
        <div className="flex gap-2 mt-2">
          {(['salon', 'llevar', 'delivery'] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setTipo(tipo)}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                tipoPedido === tipo
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tipo === 'salon' ? 'Salón' : tipo === 'llevar' ? 'Llevar' : 'Delivery'}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Selecciona productos para agregar al pedido
            </p>
          ) : (
            cart.map((item) => (
              <div key={item.producto.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm truncate">{item.producto.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    S/ {(item.producto.precio_salon * item.cantidad).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateCantidad(item.producto.id, item.cantidad - 1)}
                    className="w-7 h-7 rounded bg-muted text-foreground text-lg leading-none hover:bg-accent flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-foreground text-sm">{item.cantidad}</span>
                  <button
                    onClick={() => updateCantidad(item.producto.id, item.cantidad + 1)}
                    className="w-7 h-7 rounded bg-muted text-foreground text-lg leading-none hover:bg-accent flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem(item.producto.id)}
                    className="w-7 h-7 rounded text-red-500 hover:text-red-600 flex items-center justify-center text-xs ml-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border space-y-3">
        <Separator />
        <div className="flex justify-between">
          <span className="text-foreground font-medium">Total</span>
          <span className="text-foreground font-bold text-lg">S/ {total().toFixed(2)}</span>
        </div>
        <Button
          onClick={onEnviar}
          disabled={cart.length === 0 || submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
          size="lg"
        >
          {submitting ? 'Enviando...' : 'Enviar a cocina'}
        </Button>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="w-full text-muted-foreground hover:text-red-500 text-xs text-center transition-colors"
          >
            Limpiar pedido
          </button>
        )}
      </div>
    </div>
  )
}
