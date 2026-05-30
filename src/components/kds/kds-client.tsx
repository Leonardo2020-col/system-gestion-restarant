'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useKdsRealtime } from '@/hooks/useKdsRealtime'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
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
  listo: 'bg-emerald-500/20 border-emerald-500',
}

const estadoBadge: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  preparando: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  listo: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
}

/* ── Generar bytes ESC/POS del ticket ──────────────────────────────────── */
function buildTicketBytes(pedido: PedidoConItems, cols = 32): Uint8Array {
  const encoder = new ReceiptPrinterEncoder({
    language:         'esc-pos',
    columns:          cols,
    feedBeforeCut:    4,
    autoFlush:        true,
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
    .line(pedido.tipo === 'salon' || pedido.mesa ? 'COMANDA' : '++ PEDIDO')
    .size(1, 1)
    .bold(false)
    .line(`${mesa}  ${hora}`)
    .rule({ style: 'double' })
    .align('left')

  for (const item of pedido.items ?? []) {
    enc = enc
      .bold(true)
      .line(`${item.cantidad}x  ${item.producto?.nombre ?? '—'}`)
      .bold(false)

    if (item.notas) {
      enc = enc.invert(true).line(` ! ${item.notas} `).invert(false)
    }

    enc = enc.rule({ style: 'single' })
  }

  enc = enc
    .align('center')
    .line(new Date().toLocaleDateString('es-PE'))
    .newline()
    .cut('partial')

  return enc.encode()
}

/* ── Imprimir por WebUSB (si la impresora lo soporta) o WebSerial ──────── */
async function imprimirPorApi(bytes: Uint8Array): Promise<'usb' | 'serial' | 'pdf'> {

  /* Intento 1 – WebUSB (Chrome en Android/PC si el driver lo expone) */
  if ('usb' in navigator) {
    try {
      const device = await (navigator as any).usb.requestDevice({
        filters: [
          { vendorId: 0x04b8 },  // Epson
          { vendorId: 0x0519 },  // Star
          { vendorId: 0x154f },  // POS genérico
          { vendorId: 0x0dd4 },  // Custom
          { vendorId: 0x1fc9 },  // Generic thermal
          {},                     // cualquier impresora
        ],
      })
      await device.open()
      if (device.configuration === null) await device.selectConfiguration(1)
      const iface = device.configuration!.interfaces.find(
        (i: any) => i.alternate.interfaceClass === 7  /* Printer class */
          || i.alternate.endpoints.some((e: any) => e.direction === 'out')
      )
      if (iface) {
        await device.claimInterface(iface.interfaceNumber)
        const ep = iface.alternate.endpoints.find((e: any) => e.direction === 'out')
        if (ep) {
          await device.transferOut(ep.endpointNumber, bytes)
          await device.close()
          return 'usb'
        }
      }
    } catch { /* WebUSB no disponible o cancelado por el usuario */ }
  }

  /* Intento 2 – WebSerial (Chrome en PC, la impresora aparece como COM) */
  if ('serial' in navigator) {
    try {
      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate: 9600 })
      const writer = port.writable.getWriter()
      await writer.write(bytes)
      writer.releaseLock()
      await port.close()
      return 'serial'
    } catch { /* WebSerial no disponible o cancelado */ }
  }

  return 'pdf'
}

/* ── Fallback: abrir ventana de impresión con jsPDF ───────────────────── */
async function imprimirConPdf(pedido: PedidoConItems) {
  const { default: jsPDF } = await import('jspdf')
  const W = 58, MAR = 3, CW = W - MAR * 2
  const lh = (pt: number) => pt * 0.353 * 1.5

  let H = MAR
  H += lh(9) + 0.5 + lh(7) + 1 + 2
  ;(pedido.items ?? []).forEach((it) => {
    H += lh(8) + 1
    if (it.notas) H += lh(7) + 1
    H += 1
  })
  H += 2 + lh(7) + MAR

  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' })
  const mesa = pedido.mesa ? `MESA ${pedido.mesa.numero}` : pedido.tipo === 'llevar' ? 'PARA LLEVAR' : 'DELIVERY'
  const hora = format(new Date(pedido.created_at), 'HH:mm', { locale: es })
  let y = MAR

  doc.setFont('courier', 'bold'); doc.setFontSize(9)
  doc.text('COMANDA', W / 2, y + lh(9), { align: 'center' }); y += lh(9) + 0.5
  doc.setFont('courier', 'normal'); doc.setFontSize(7)
  doc.text(`${mesa}  ${hora}`, W / 2, y + lh(7), { align: 'center' }); y += lh(7) + 1
  doc.setLineWidth(0.4); doc.line(MAR, y, W - MAR, y); y += 2

  ;(pedido.items ?? []).forEach((item) => {
    doc.setFont('courier', 'bold'); doc.setFontSize(8)
    const lines = doc.splitTextToSize(`${item.cantidad}x  ${item.producto?.nombre ?? '—'}`, CW)
    doc.text(lines, MAR, y + lh(8)); y += lh(8) * lines.length + 0.5
    if (item.notas) {
      doc.setFontSize(7)
      const nw = Math.min(doc.getTextWidth(`! ${item.notas}`) + 3, CW)
      const nh = lh(7) + 0.5
      doc.setFillColor(0, 0, 0); doc.rect(MAR, y, nw, nh, 'F')
      doc.setTextColor(255); doc.text(`! ${item.notas}`, MAR + 1.5, y + lh(7))
      doc.setTextColor(0); y += nh + 0.5
    }
    doc.setLineDashPattern([0.8, 0.8], 0); doc.setDrawColor(120); doc.setLineWidth(0.2)
    doc.line(MAR, y, W - MAR, y); doc.setLineDashPattern([], 0); doc.setDrawColor(0); y += 1.5
  })

  y += 0.5; doc.setLineWidth(0.3); doc.line(MAR, y, W - MAR, y); y += 1.5
  doc.setFontSize(6); doc.setFont('courier', 'normal'); doc.setTextColor(80)
  doc.text(new Date().toLocaleDateString('es-PE'), W / 2, y + lh(6), { align: 'center' })

  doc.save(`comanda-${mesa.replace(/\s/g, '-')}.pdf`)
}

/* ── Función principal de impresión ────────────────────────────────────── */
async function imprimirComanda(pedido: PedidoConItems, silent = false) {
  const bytes = buildTicketBytes(pedido)
  const method = await imprimirPorApi(bytes)

  if (method === 'usb')    { if (!silent) toast.success('✓ Impreso por USB'); return }
  if (method === 'serial') { if (!silent) toast.success('✓ Impreso por Serial/COM'); return }

  /* Fallback PDF */
  await imprimirConPdf(pedido)
  if (!silent) toast.info('📄 PDF descargado — ábrelo e imprímelo desde Adobe Reader o Edge')
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function KdsClient({ pedidosIniciales, tenantId }: Props) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const impresosRef = useRef<Set<string>>(new Set())

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

  /* ── Auto-imprimir pedidos nuevos ─────────────────────────────────────
     Cuando llega un pedido 'pendiente' que aún no hemos impreso,
     lo imprimimos automáticamente (modo silencioso).                     */
  const autoImprimir = useCallback((lista: PedidoConItems[]) => {
    lista
      .filter((p) => p.estado === 'pendiente' && !impresosRef.current.has(p.id))
      .forEach((p) => {
        impresosRef.current.add(p.id)
        imprimirComanda(p, true)
          .catch(() => { /* silencioso */ })
      })
  }, [])

  useEffect(() => {
    if (pedidos.length > 0) autoImprimir(pedidos)
  }, [pedidos, autoImprimir])

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

                {/* Botón imprimir manual */}
                <button
                  onClick={() => imprimirComanda(pedido)}
                  title="Reimprimir ticket"
                  className="text-lg hover:scale-110 transition-transform shrink-0"
                >
                  🖨️
                </button>
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
                        <span className="text-yellow-600 dark:text-yellow-400 text-xs ml-auto shrink-0">
                          📝 {item.notas}
                        </span>
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
