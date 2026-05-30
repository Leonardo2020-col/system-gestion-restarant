'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useKdsRealtime } from '@/hooks/useKdsRealtime'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
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
  listo:      'bg-emerald-500/20 border-emerald-500',
}
const estadoBadge: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  preparando: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  listo:      'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
}

/* ── Construir bytes ESC/POS ──────────────────────────────────────────── */
function buildTicketBytes(pedido: PedidoConItems, cols = 32): Uint8Array {
  const encoder = new ReceiptPrinterEncoder({
    language:    'esc-pos',
    columns:     cols,
    autoFlush:   true,
  })

  const mesa = pedido.mesa
    ? `MESA ${pedido.mesa.numero}`
    : pedido.tipo === 'llevar' ? 'PARA LLEVAR' : 'DELIVERY'

  const hora = format(new Date(pedido.created_at), 'HH:mm', { locale: es })

  let enc = encoder
    .initialize()
    .align('center')
    .bold(true)
    .size(2, 2)
    .line('COMANDA')
    .size(1, 1)
    .bold(false)
    .line(`${mesa}  ${hora}`)
    .rule({ style: 'double' })
    .align('left')

  for (const item of pedido.items ?? []) {
    enc = enc.bold(true).line(`${item.cantidad}x  ${item.producto?.nombre ?? '—'}`).bold(false)
    if (item.notas) enc = enc.invert(true).line(` ! ${String(item.notas)} `).invert(false)
    enc = enc.rule({ style: 'single' })
  }

  return enc
    .align('center')
    .line(new Date().toLocaleDateString('es-PE'))
    .newline()
    .cut('partial')
    .encode()
}

/* ── Detector de modo (local vs nube) ─────────────────────────────────── */
function isLocalhost() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.')
}

/* ── Imprimir vía API local (solo funciona en localhost) ──────────────── */
async function imprimirViaApi(
  pedido: PedidoConItems,
  paperSize: '58mm' | '80mm'
): Promise<boolean> {
  try {
    const mesa = pedido.mesa ? pedido.mesa.numero : null
    const items = (pedido.items ?? []).map((i) => ({
      nombre:   i.producto?.nombre ?? '—',
      cantidad: i.cantidad,
      notas:    i.notas ?? null,
    }))
    const hora = format(new Date(pedido.created_at), 'HH:mm', { locale: es })

    const res = await fetch('/api/imprimir-ticket', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mesa, items, hora, esAgregado: false, paperSize }),
    })
    return res.ok
  } catch {
    return false
  }
}

/* ── Hook de estado de impresora ─────────────────────────────────────── */
function usePrinterStatus() {
  const [status, setStatus] = useState<'local' | 'cloud' | 'checking'>('checking')

  useEffect(() => {
    // Pequeño delay para que el window esté disponible en el cliente
    const t = setTimeout(() => setStatus(isLocalhost() ? 'local' : 'cloud'), 100)
    return () => clearTimeout(t)
  }, [])

  return status
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function KdsClient({ pedidosIniciales, tenantId }: Props) {
  const queryClient = useQueryClient()
  const supabase    = createClient()
  const impresosRef = useRef<Set<string>>(new Set())
  const printerMode = usePrinterStatus()   // 'local' | 'cloud' | 'checking'
  const [paperSize] = useState<'58mm' | '80mm'>('58mm')

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

  /* ── Imprimir un pedido ─────────────────────────────────────────────
     En modo local:  POST /api/imprimir-ticket → PowerShell → POS-58
     En modo cloud:  aviso (la impresión ocurre en la PC de cocina)    */
  const imprimirComanda = useCallback(async (pedido: PedidoConItems, silent = false) => {
    if (printerMode === 'cloud') {
      if (!silent) toast.info('Esta PC no tiene acceso a la impresora.\nAbre esta página en localhost en la PC de cocina.')
      return
    }
    const ok = await imprimirViaApi(pedido, paperSize)
    if (ok) {
      if (!silent) toast.success('✓ Ticket impreso')
    } else {
      if (!silent) toast.error('Error al imprimir — revisa que el servidor local esté corriendo')
    }
  }, [printerMode, paperSize])

  /* ── Auto-imprimir pedidos nuevos (estado 'pendiente') ─────────────── */
  const autoImprimir = useCallback((lista: PedidoConItems[]) => {
    lista
      .filter((p) => p.estado === 'pendiente' && !impresosRef.current.has(p.id))
      .forEach((p) => {
        impresosRef.current.add(p.id)
        imprimirComanda(p, true)
      })
  }, [imprimirComanda])

  useEffect(() => {
    if (pedidos.length > 0) autoImprimir(pedidos)
  }, [pedidos, autoImprimir])

  /* ── Mutaciones ────────────────────────────────────────────────────── */
  const avanzar = useMutation({
    mutationFn: async (pedidoId: string) => {
      const pedido = pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return
      const nuevoEstado = estadoNext[pedido.estado as keyof typeof estadoNext]
      if (!nuevoEstado) return
      const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos', tenantId] }),
    onError:   () => toast.error('Error al actualizar estado'),
  })

  const avanzarItem = useMutation({
    mutationFn: async ({ itemId, estado }: { itemId: string; estado: string }) => {
      const { error } = await supabase.from('pedido_items').update({ estado }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos', tenantId] }),
  })

  /* ── UI ────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Header con estado de impresora */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-foreground text-2xl font-bold">Cocina</h1>
          <Badge variant="secondary">{pedidos.length} pedidos activos</Badge>
        </div>

        {/* Indicador de modo de impresión */}
        <div className="flex items-center gap-2">
          {printerMode === 'checking' && (
            <span className="text-xs text-muted-foreground">Detectando modo…</span>
          )}
          {printerMode === 'local' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Modo local — impresión directa
            </span>
          )}
          {printerMode === 'cloud' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Modo nube — solo visualización
            </span>
          )}
        </div>
      </div>

      {/* Banner modo nube */}
      {printerMode === 'cloud' && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">📱 Esta es la vista de tablets / nube</p>
          <p>
            Para impresión automática sin diálogos, la <strong>PC de cocina</strong> debe abrir esta página en modo local:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 ml-2">
            <li>En la PC con la impresora: abre una terminal</li>
            <li>Ejecuta <code className="bg-blue-500/20 px-1 rounded">pnpm start</code> (o <code className="bg-blue-500/20 px-1 rounded">pnpm dev</code>)</li>
            <li>Abre Chrome en <code className="bg-blue-500/20 px-1 rounded">http://localhost:3000/cocina</code></li>
          </ol>
          <p className="text-xs opacity-75 mt-1">Los pedidos llegan en tiempo real desde Supabase e imprimen automáticamente en la POS-58.</p>
        </div>
      )}

      {/* Tarjetas de pedidos */}
      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
          <span className="text-6xl mb-4">🍳</span>
          <p className="text-xl">Sin pedidos pendientes</p>
          <p className="text-sm mt-1">Los nuevos pedidos aparecerán aquí en tiempo real</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pedidos.map((pedido) => {
            const estado = pedido.estado
            const mins   = Math.floor((Date.now() - new Date(pedido.created_at).getTime()) / 60000)
            const urgent = mins >= 15

            return (
              <div
                key={pedido.id}
                className={`rounded-xl border-2 p-4 flex flex-col gap-3 ${estadoColor[estado] ?? estadoColor.pendiente}`}
              >
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-bold text-lg">
                        {pedido.mesa
                          ? `Mesa ${pedido.mesa.numero}`
                          : pedido.tipo === 'llevar' ? 'Para llevar' : 'Delivery'}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoBadge[estado] ?? estadoBadge.pendiente}`}>
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${urgent ? 'text-red-600 dark:text-red-400 font-bold' : 'text-muted-foreground'}`}>
                      {urgent ? '⚠️ ' : ''}{mins}min · {format(new Date(pedido.created_at), 'HH:mm', { locale: es })}
                    </p>
                  </div>

                  {/* Botón reimprimir */}
                  <button
                    onClick={() => imprimirComanda(pedido)}
                    title="Reimprimir ticket"
                    className="text-lg hover:scale-110 transition-transform shrink-0"
                  >
                    🖨️
                  </button>
                </div>

                {/* Ítems */}
                <ul className="space-y-2">
                  {pedido.items?.map((item) => {
                    const isListo = item.estado === 'listo' || item.estado === 'entregado'
                    return (
                      <li key={item.id} className="flex items-center gap-2">
                        <button
                          onClick={() => avanzarItem.mutate({ itemId: item.id, estado: isListo ? 'pendiente' : 'listo' })}
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
                          <span className="text-yellow-600 dark:text-yellow-400 text-xs ml-auto shrink-0">
                            📝 {item.notas}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {/* Botón avanzar estado */}
                {estado !== 'listo' ? (
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
                ) : (
                  <div className="text-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                    ✓ Listo para entregar
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
