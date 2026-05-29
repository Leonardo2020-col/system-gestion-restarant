'use client'
import { usePosStore } from '@/stores/pos.store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

type Props = {
  onEnviar: () => void
  submitting: boolean
  hayPedidoActivo: boolean
  pedidoActivoTotal: number
  onCobrar: () => void
}

export function Cart({ onEnviar, submitting, hayPedidoActivo, pedidoActivoTotal, onCobrar }: Props) {
  const { cart, updateCantidad, removeItem, updateNotas, total, clearCart, tipoPedido, setTipo } = usePosStore()

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-foreground font-semibold">
          {hayPedidoActivo ? 'Agregar platos' : 'Nuevo pedido'}
        </h2>
        {!hayPedidoActivo && (
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
        )}
        {hayPedidoActivo && (
          <p className="text-muted-foreground text-xs mt-1">
            Comanda activa: S/ {pedidoActivoTotal.toFixed(2)}
          </p>
        )}
      </div>

      {/* Items del carrito */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {hayPedidoActivo
                ? 'Selecciona productos para agregar'
                : 'Selecciona productos para agregar al pedido'}
            </p>
          ) : (
            cart.map((item) => (
              <div key={item.producto.id} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm truncate">{item.producto.nombre}</p>
                    <p className="text-muted-foreground text-xs">
                      S/ {(Number(item.producto.precio_salon) * item.cantidad).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateCantidad(item.producto.id, item.cantidad - 1)}
                      className="w-7 h-7 rounded bg-muted text-foreground text-lg leading-none hover:bg-accent flex items-center justify-center"
                    >−</button>
                    <span className="w-6 text-center text-foreground text-sm">{item.cantidad}</span>
                    <button
                      onClick={() => updateCantidad(item.producto.id, item.cantidad + 1)}
                      className="w-7 h-7 rounded bg-muted text-foreground text-lg leading-none hover:bg-accent flex items-center justify-center"
                    >+</button>
                    <button
                      onClick={() => removeItem(item.producto.id)}
                      className="w-7 h-7 rounded text-red-500 hover:text-red-600 flex items-center justify-center text-xs ml-1"
                    >✕</button>
                  </div>
                </div>
                {/* Observación */}
                <input
                  type="text"
                  value={item.notas ?? ''}
                  onChange={(e) => updateNotas(item.producto.id, e.target.value)}
                  placeholder="Observación (ej: sin picante, extra queso…)"
                  className="w-full text-xs px-2 py-1 rounded bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  maxLength={80}
                />
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        <Separator />
        <div className="flex justify-between">
          <span className="text-foreground font-medium">
            {hayPedidoActivo ? 'A agregar' : 'Total'}
          </span>
          <span className="text-foreground font-bold text-lg">S/ {total().toFixed(2)}</span>
        </div>
        {hayPedidoActivo && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total comanda</span>
            <span className="font-semibold text-foreground">
              S/ {(pedidoActivoTotal + total()).toFixed(2)}
            </span>
          </div>
        )}

        {/* Enviar */}
        <Button
          onClick={onEnviar}
          disabled={cart.length === 0 || submitting}
          className={`w-full ${hayPedidoActivo ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`}
          size="lg"
        >
          {submitting
            ? 'Enviando...'
            : hayPedidoActivo
            ? 'Agregar a comanda'
            : 'Enviar a cocina'}
        </Button>

        {/* Cobrar (solo si hay pedido activo) */}
        {hayPedidoActivo && (
          <Button
            onClick={onCobrar}
            variant="outline"
            className="w-full border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            size="lg"
          >
            💰 Cobrar S/ {pedidoActivoTotal.toFixed(2)}
          </Button>
        )}

        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="w-full text-muted-foreground hover:text-red-500 text-xs text-center transition-colors"
          >
            Limpiar carrito
          </button>
        )}
      </div>
    </div>
  )
}
