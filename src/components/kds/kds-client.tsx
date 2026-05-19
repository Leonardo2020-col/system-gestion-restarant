'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useKdsRealtime } from '@/hooks/useKdsRealtime'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PedidoConItems } from '@/lib/queries/pedidos'

type Props = {
  pedidosIniciales: PedidoConItems[]
  tenantId: string
}

const estadoNext = {
  pendiente: 'preparando',
  preparando: 'listo',
  listo: 'entregado',
} as const

const estadoColor: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 border-yellow-500',
  preparando: 'bg-blue-500/20 border-blue-500',
  listo: 'bg-emerald-500/20 border-emerald-500',
}

const estadoBadge: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  preparando: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  listo: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
}

export function KdsClient({ pedidosIniciales, tenantId }: Props) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useKdsRealtime(tenantId)

  const { data: pedidos = pedidosIniciales } = useQuery({
    queryKey: ['pedidos', tenantId],
    queryFn: async (): Promise<PedidoConItems[]> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          mesa:mesas(numero, salon:salones(nombre)),
          usuario:usuarios(nombre),
          items:pedido_items(*, producto:productos(nombre))
        `)
        .eq('tenant_id', tenantId)
        .in('estado', ['pendiente', 'preparando'])
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as PedidoConItems[]
    },
    initialData: pedidosIniciales,
  })

  const avanzar = useMutation({
    mutationFn: async (pedidoId: string) => {
      const pedido = pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return
      const nuevoEstado = estadoNext[pedido.estado as keyof typeof estadoNext]
      if (!nuevoEstado) return
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos', tenantId] }),
    onError: () => toast.error('Error al actualizar estado'),
  })

  const avanzarItem = useMutation({
    mutationFn: async ({ itemId, estado }: { itemId: string; estado: string }) => {
      const { error } = await supabase
        .from('pedido_items')
        .update({ estado })
        .eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos', tenantId] }),
  })

  if (pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <span className="text-6xl mb-4">🍳</span>
        <p className="text-xl">Sin pedidos pendientes</p>
        <p className="text-sm mt-1">Los nuevos pedidos aparecerán aquí en tiempo real</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-foreground text-2xl font-bold">Cocina</h1>
        <Badge variant="secondary">{pedidos.length} pedidos activos</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pedidos.map((pedido) => {
          const estado = pedido.estado
          const minutosTranscurridos = Math.floor(
            (Date.now() - new Date(pedido.created_at).getTime()) / 60000
          )
          const esUrgente = minutosTranscurridos >= 15

          return (
            <div
              key={pedido.id}
              className={`rounded-xl border-2 p-4 flex flex-col gap-3 ${estadoColor[estado] ?? estadoColor.pendiente}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-bold text-lg">
                      {pedido.mesa
                        ? `Mesa ${pedido.mesa.numero}`
                        : pedido.tipo === 'llevar'
                        ? 'Para llevar'
                        : 'Delivery'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoBadge[estado] ?? estadoBadge.pendiente}`}>
                      {estado.charAt(0).toUpperCase() + estado.slice(1)}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${esUrgente ? 'text-red-600 dark:text-red-400 font-bold' : 'text-muted-foreground'}`}>
                    {esUrgente ? '⚠️ ' : ''}
                    {minutosTranscurridos}min · {format(new Date(pedido.created_at), 'HH:mm', { locale: es })}
                  </p>
                </div>
              </div>

              <ul className="space-y-2">
                {pedido.items?.map((item) => {
                  const itemEstado = item.estado
                  const isListo = itemEstado === 'listo' || itemEstado === 'entregado'
                  return (
                    <li key={item.id} className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          avanzarItem.mutate({ itemId: item.id, estado: isListo ? 'pendiente' : 'listo' })
                        }
                        className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                          isListo ? 'bg-emerald-500 border-emerald-400' : 'border-border hover:border-foreground'
                        }`}
                      >
                        {isListo && <span className="text-white text-xs">✓</span>}
                      </button>
                      <span className={`text-sm ${isListo ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        <span className="font-bold">{item.cantidad}×</span> {item.producto?.nombre}
                      </span>
                      {item.notas && (
                        <span className="text-yellow-600 dark:text-yellow-400 text-xs ml-auto shrink-0">📝 {item.notas}</span>
                      )}
                    </li>
                  )
                })}
              </ul>

              {estado !== 'listo' && (
                <button
                  onClick={() => avanzar.mutate(pedido.id)}
                  disabled={avanzar.isPending}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                    estado === 'pendiente'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {estado === 'pendiente' ? 'Iniciar preparación' : 'Marcar listo'}
                </button>
              )}
              {estado === 'listo' && (
                <div className="text-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                  ✓ Listo para entregar
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
