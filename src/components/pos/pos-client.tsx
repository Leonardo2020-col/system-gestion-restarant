'use client'
import { useState, useRef } from 'react'
import { buildEscPos, toBase64 } from '@/lib/escpos'
import jsPDF from 'jspdf'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePosStore } from '@/stores/pos.store'
import { MesaGrid } from './mesa-grid'
import { ProductGrid } from './product-grid'
import { Cart } from './cart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Salon, Categoria, Cliente } from '@/types/supabase'
import type { MesaConSalon } from '@/lib/queries/mesas'
import type { ProductoConCategoria } from '@/lib/queries/productos'
import type { PedidoItemDetalle } from '@/stores/pos.store'

type TicketItem = { nombre: string; cantidad: number; notas?: string | null }
type TicketData = { mesa: number | null; items: TicketItem[]; hora: string; esAgregado: boolean }

type View = 'mesas' | 'productos' | 'cobrar'

type Props = {
  mesas: MesaConSalon[]
  salones: Salon[]
  categorias: Categoria[]
  productos: ProductoConCategoria[]
  tenantId: string
  usuarioId: string
}

export function PosClient({ mesas: initMesas, salones, categorias, productos, tenantId, usuarioId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const store = usePosStore()
  const [view, setView] = useState<View>('mesas')
  const [mesas, setMesas] = useState(initMesas)
  const [loadingMesa, setLoadingMesa] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  /* ── Cobrar dialog state ── */
  const [cobrarOpen, setCobrarOpen] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteResults, setClienteResults] = useState<Cliente[]>([])
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', dni_ruc: '', telefono: '' })
  const [cobrando, setCobrando] = useState(false)
  const [comandaItems, setComandaItems] = useState<PedidoItemDetalle[]>([])
  const [comandaTotal, setComandaTotal] = useState(0)

  /* ── Ticket de cocina ── */
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm')
  const ticketRef = useRef<HTMLDivElement>(null)

  /* ── Seleccionar mesa ── */
  async function selectMesa(mesa: MesaConSalon) {
    store.clearAll()
    store.setMesa(mesa.id, mesa.numero)

    if (mesa.estado === 'libre' || mesa.estado === 'reservada') {
      setView('productos')
      return
    }

    /* Mesa ocupada → cargar pedido activo */
    setLoadingMesa(true)
    try {
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, total')
        .eq('mesa_id', mesa.id)
        .in('estado', ['pendiente', 'preparando', 'listo'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (!pedidos || pedidos.length === 0) {
        /* No hay pedido activo aunque la mesa figure ocupada */
        setView('productos')
        return
      }

      const pedido = pedidos[0]
      const { data: items } = await supabase
        .from('pedido_items')
        .select('id, producto_id, cantidad, precio_unit, estado, producto:productos(nombre)')
        .eq('pedido_id', pedido.id)

      const detalle: PedidoItemDetalle[] = (items ?? []).map((it: any) => ({
        id: it.id,
        producto_id: it.producto_id,
        nombre: it.producto?.nombre ?? '—',
        cantidad: it.cantidad,
        precio_unit: Number(it.precio_unit),
        estado: it.estado,
      }))

      store.setPedidoActivo(pedido.id, detalle, Number(pedido.total))
      setView('productos')
    } catch {
      toast.error('Error al cargar comanda')
    } finally {
      setLoadingMesa(false)
    }
  }

  /* ── Mostrar ticket de cocina ── */
  function mostrarTicket(items: TicketItem[], esAgregado: boolean) {
    setTicketData({
      mesa: mesaActual?.numero ?? null,
      items,
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      esAgregado,
    })
    setTicketOpen(true)
  }

  async function imprimirTicket() {
    if (!ticketData) return

    /* ── Intento 1: API local /api/imprimir-ticket (Windows ESC/POS directo) */
    try {
      const res = await fetch('/api/imprimir-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ticketData,
          paperSize,
          printerName: paperSize === '80mm' ? 'POS-80' : 'POS-58',
        }),
      })
      if (res.ok) {
        toast.success('✓ Ticket enviado a la impresora')
        setTicketOpen(false)
        return
      }
    } catch {
      /* API no disponible → intentar QZ Tray */
    }

    const escBytes = buildEscPos({ ...ticketData, paperSize })

    /* ── Intento 2: QZ Tray (impresión directa sin diálogo) ─────────────
       Requiere QZ Tray instalado en la PC: https://qz.io/download/      */
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qz = (await import('qz-tray')).default as any

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({ host: 'localhost', port: { secure: [8181], insecure: [8182] } })
      }

      const config = qz.configs.create(paperSize === '80mm' ? 'POS-80' : 'POS-58')
      await qz.print(config, [{ type: 'raw', format: 'base64', data: toBase64(escBytes) }])

      toast.success('✓ Ticket enviado a la impresora')
      setTicketOpen(false)
      return
    } catch {
      /* QZ Tray no disponible → usar PDF como fallback */
    }

    /* ── Fallback: PDF con jsPDF ─────────────────────────────────────────
       Genera un PDF de 58×H mm. Al abrirlo en Adobe Reader o Edge,
       imprime correctamente en papel térmico.                            */
    const is80 = paperSize === '80mm'
    const W = is80 ? 80 : 58
    const MAR = 3
    const CW = W - MAR * 2
    const FT = is80 ? 10 : 9
    const FS = is80 ? 8 : 7
    const FN = is80 ? 9 : 8
    const FA = is80 ? 7 : 6
    const lh = (pt: number) => pt * 0.353 * 1.5

    let H = MAR
    H += lh(FT) + 0.5
    H += lh(FS) + 1
    H += 2
    ticketData.items.forEach((it) => {
      H += lh(FN) + 1
      if (it.notas) H += lh(FA) + 1
      H += 1
    })
    H += 2 + lh(FS) + MAR

    const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' })
    let y = MAR

    doc.setFont('courier', 'bold')
    doc.setFontSize(FT)
    doc.text(ticketData.esAgregado ? '++ ADICIONAL' : 'COMANDA', W / 2, y + lh(FT), { align: 'center' })
    y += lh(FT) + 0.5

    doc.setFont('courier', 'normal')
    doc.setFontSize(FS)
    doc.text(`${ticketData.mesa ? 'MESA ' + ticketData.mesa : 'SIN MESA'}  ${ticketData.hora}`, W / 2, y + lh(FS), { align: 'center' })
    y += lh(FS) + 1

    doc.setDrawColor(0); doc.setLineWidth(0.4)
    doc.line(MAR, y, W - MAR, y); y += 2

    ticketData.items.forEach((item) => {
      doc.setFont('courier', 'bold'); doc.setFontSize(FN)
      const lines = doc.splitTextToSize(`${item.cantidad}x  ${item.nombre}`, CW)
      doc.text(lines, MAR, y + lh(FN))
      y += lh(FN) * lines.length + 0.5

      if (item.notas) {
        doc.setFontSize(FA)
        const nw = Math.min(doc.getTextWidth(`! ${item.notas}`) + 3, CW)
        const nh = lh(FA) + 0.5
        doc.setFillColor(0, 0, 0)
        doc.rect(MAR, y, nw, nh, 'F')
        doc.setTextColor(255, 255, 255)
        doc.text(`! ${item.notas}`, MAR + 1.5, y + lh(FA))
        doc.setTextColor(0, 0, 0)
        y += nh + 0.5
      }

      doc.setLineDashPattern([0.8, 0.8], 0); doc.setDrawColor(120); doc.setLineWidth(0.2)
      doc.line(MAR, y, W - MAR, y)
      doc.setLineDashPattern([], 0); doc.setDrawColor(0); y += 1.5
    })

    y += 0.5; doc.setLineWidth(0.3); doc.line(MAR, y, W - MAR, y); y += 1.5
    doc.setFontSize(FS - 1); doc.setFont('courier', 'normal'); doc.setTextColor(80)
    doc.text(new Date().toLocaleDateString('es-PE'), W / 2, y + lh(FS - 1), { align: 'center' })

    /* Descargar el PDF — el usuario lo abre en su visor y lo imprime */
    doc.save(`comanda${ticketData.mesa ? '-mesa-' + ticketData.mesa : ''}.pdf`)
    toast.info('📄 PDF descargado. Ábrelo e imprime desde Adobe Reader o Edge para resultado correcto.', { duration: 6000 })
  }

  /* ── Enviar a cocina ── */
  async function enviarPedido() {
    if (store.cart.length === 0) { toast.error('El carrito está vacío'); return }
    setSubmitting(true)

    /* Capturar items del carrito antes de limpiar */
    const ticketItems: TicketItem[] = store.cart.map((i) => ({
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      notas: i.notas?.trim() || null,
    }))

    try {
      if (store.pedidoActivoId) {
        /* ─ AGREGAR a pedido existente ─ */
        const itemsInsert = store.cart.map((i) => ({
          pedido_id: store.pedidoActivoId!,
          producto_id: i.producto.id,
          cantidad: i.cantidad,
          precio_unit: Number(i.producto.precio_salon),
          descuento: 0,
          notas: i.notas?.trim() || null,
          estado: 'pendiente' as const,
        }))
        const { error: errItems } = await supabase.from('pedido_items').insert(itemsInsert)
        if (errItems) throw new Error(errItems.message)

        const nuevoTotal = store.pedidoActivoTotal + store.total()
        await supabase.from('pedidos').update({ total: nuevoTotal }).eq('id', store.pedidoActivoId)

        /* Actualizar items en store */
        const newDetalle: PedidoItemDetalle[] = store.cart.map((i) => ({
          id: crypto.randomUUID(),
          producto_id: i.producto.id,
          nombre: i.producto.nombre,
          cantidad: i.cantidad,
          precio_unit: Number(i.producto.precio_salon),
          estado: 'pendiente',
        }))
        store.setPedidoActivo(
          store.pedidoActivoId,
          [...store.pedidoActivoItems, ...newDetalle],
          nuevoTotal
        )
        store.clearCart()
        toast.success('Platos agregados a la comanda ✓')
        mostrarTicket(ticketItems, true)
      } else {
        /* ─ NUEVO pedido ─ */
        const res = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mesa_id: store.mesaId,
            tipo: store.tipoPedido,
            total: Number(store.total()),
            items: store.cart.map((i) => ({
              producto_id: i.producto.id,
              cantidad: i.cantidad,
              precio_unit: Number(i.producto.precio_salon),
              notas: i.notas?.trim() || undefined,
            })),
          }),
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(txt)
        }
        const { id: pedidoId } = await res.json()

        /* Guardar pedido activo en store */
        const detalle: PedidoItemDetalle[] = store.cart.map((i) => ({
          id: crypto.randomUUID(),
          producto_id: i.producto.id,
          nombre: i.producto.nombre,
          cantidad: i.cantidad,
          precio_unit: Number(i.producto.precio_salon),
          estado: 'pendiente',
        }))
        store.setPedidoActivo(pedidoId, detalle, Number(store.total()))

        /* Marcar mesa como ocupada en lista local */
        setMesas((prev) =>
          prev.map((m) => m.id === store.mesaId ? { ...m, estado: 'ocupada' as const } : m)
        )
        store.clearCart()
        toast.success('Pedido enviado a cocina ✓')
        mostrarTicket(ticketItems, false)
        router.refresh()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error: ${msg.slice(0, 120)}`)
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Abrir cobrar ── */
  async function abrirCobrar() {
    if (!store.pedidoActivoId) { toast.error('No hay pedido activo'); return }

    /* Refrescar items del pedido */
    const { data: items } = await supabase
      .from('pedido_items')
      .select('id, producto_id, cantidad, precio_unit, estado, producto:productos(nombre)')
      .eq('pedido_id', store.pedidoActivoId)

    const detalle: PedidoItemDetalle[] = (items ?? []).map((it: any) => ({
      id: it.id,
      producto_id: it.producto_id,
      nombre: it.producto?.nombre ?? '—',
      cantidad: it.cantidad,
      precio_unit: Number(it.precio_unit),
      estado: it.estado,
    }))

    const total = detalle.reduce((s, i) => s + i.precio_unit * i.cantidad, 0)
    setComandaItems(detalle)
    setComandaTotal(total)
    setClienteSearch('')
    setClienteResults([])
    setCreandoCliente(false)
    setNuevoCliente({ nombre: '', dni_ruc: '', telefono: '' })
    setCobrarOpen(true)
  }

  /* ── Buscar cliente ── */
  async function buscarCliente(q: string) {
    setClienteSearch(q)
    if (q.length < 2) { setClienteResults([]); return }
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`nombre.ilike.%${q}%,dni_ruc.ilike.%${q}%,telefono.ilike.%${q}%`)
      .limit(5)
    setClienteResults((data ?? []) as Cliente[])
  }

  /* ── Crear / guardar cliente nuevo ── devuelve el id o null ── */
  async function guardarNuevoCliente(): Promise<{ id: string; nombre: string } | null> {
    if (!nuevoCliente.nombre.trim()) { toast.error('El nombre del cliente es obligatorio'); return null }
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        tenant_id: tenantId,
        nombre: nuevoCliente.nombre.trim(),
        dni_ruc: nuevoCliente.dni_ruc.trim() || null,
        telefono: nuevoCliente.telefono.trim() || null,
      })
      .select('id, nombre')
      .single()
    if (error) { toast.error(`Error al guardar cliente: ${error.message}`); return null }
    store.setCliente(data.id, data.nombre)
    setCreandoCliente(false)
    setNuevoCliente({ nombre: '', dni_ruc: '', telefono: '' })
    toast.success(`Cliente "${data.nombre}" registrado ✓`)
    return { id: data.id, nombre: data.nombre }
  }

  /* Botón explícito "Guardar cliente" (sin cobrar) */
  async function crearCliente() {
    await guardarNuevoCliente()
  }

  /* ── Confirmar cobro ── */
  async function confirmarCobro() {
    if (!store.pedidoActivoId || !store.mesaId) return
    setCobrando(true)
    try {
      /* 0. Si el formulario de nuevo cliente está abierto y tiene nombre → guardarlo primero */
      let clienteIdFinal = store.clienteId
      if (creandoCliente && nuevoCliente.nombre.trim()) {
        const cli = await guardarNuevoCliente()
        if (!cli) { setCobrando(false); return }
        clienteIdFinal = cli.id
      }

      /* 1. Marcar pedido como entregado + vincular cliente */
      const { error: errPedido } = await supabase
        .from('pedidos')
        .update({
          estado: 'entregado',
          ...(clienteIdFinal ? { cliente_id: clienteIdFinal } : {}),
        })
        .eq('id', store.pedidoActivoId)
      if (errPedido) throw new Error(`Pedido: ${errPedido.message}`)

      /* 2. Liberar mesa */
      const { error: errMesa } = await supabase
        .from('mesas')
        .update({ estado: 'libre' })
        .eq('id', store.mesaId)
      if (errMesa) throw new Error(`Mesa: ${errMesa.message}`)

      /* 3. Registrar ingreso en caja abierta */
      const { data: cajasOpen, error: errCajaBusq } = await supabase
        .from('cajas')
        .select('id')
        .is('cerrada_at', null)
        .order('abierta_at', { ascending: false })
        .limit(1)

      if (errCajaBusq) {
        toast.warning(`Cobro completado, pero error buscando caja: ${errCajaBusq.message}`)
      } else if (!cajasOpen || cajasOpen.length === 0) {
        toast.warning('Cobro completado — no hay caja abierta. Abre la caja para registrar ingresos.')
      } else {
        const cajaId = cajasOpen[0].id
        const concepto = `Venta Mesa ${mesaActual?.numero ?? '?'} — Pedido #${store.pedidoActivoId.slice(-6).toUpperCase()}${clienteIdFinal && store.clienteNombre ? ` | ${store.clienteNombre}` : ''}`
        const { error: errMov } = await supabase
          .from('movimientos_caja')
          .insert({ caja_id: cajaId, tipo: 'ingreso', monto: comandaTotal, concepto })
        if (errMov) {
          toast.warning(`Cobro completado, pero no se registró en caja: ${errMov.message}`)
        }
      }

      /* 4. Acumular puntos de fidelidad al cliente */
      if (clienteIdFinal) {
        const { data: cli } = await supabase
          .from('clientes')
          .select('puntos')
          .eq('id', clienteIdFinal)
          .single()
        if (cli) {
          const puntosGanados = Math.floor(comandaTotal) // 1 punto por cada sol
          await supabase
            .from('clientes')
            .update({ puntos: (Number(cli.puntos) ?? 0) + puntosGanados })
            .eq('id', clienteIdFinal)
        }
      }

      /* 5. Actualizar UI */
      setMesas((prev) =>
        prev.map((m) => m.id === store.mesaId ? { ...m, estado: 'libre' as const } : m)
      )
      toast.success(`Cobro de S/ ${comandaTotal.toFixed(2)} registrado ✓`)
      setCobrarOpen(false)
      store.clearAll()
      setView('mesas')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error al cobrar: ${msg}`)
    } finally {
      setCobrando(false)
    }
  }

  const mesaActual = mesas.find((m) => m.id === store.mesaId)
  const hayPedidoActivo = !!store.pedidoActivoId

  /* ─── UI ─── */
  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">
      {/* ── Panel izquierdo ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs de navegación */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setView('mesas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'mesas' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Mesas
          </button>
          {store.mesaId && (
            <button
              onClick={() => setView('productos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'productos' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Productos {mesaActual && `— Mesa ${mesaActual.numero}`}
            </button>
          )}
          {hayPedidoActivo && (
            <button
              onClick={() => setView('cobrar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'cobrar'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500'
              }`}
            >
              💰 Cobrar — S/ {store.pedidoActivoTotal.toFixed(2)}
            </button>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto">
          {loadingMesa ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Cargando comanda…
            </div>
          ) : view === 'mesas' ? (
            <MesaGrid
              mesas={mesas}
              salones={salones}
              selectedId={store.mesaId}
              onSelect={(id) => {
                const m = mesas.find((x) => x.id === id)
                if (m) selectMesa(m)
              }}
            />
          ) : view === 'productos' ? (
            <>
              {/* Banner de comanda activa */}
              {hayPedidoActivo && (
                <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm">
                  <span className="text-orange-700 dark:text-orange-300 font-medium">
                    Mesa {mesaActual?.numero} — Comanda activa: S/ {store.pedidoActivoTotal.toFixed(2)}
                    {' · '}{store.pedidoActivoItems.length} ítem(s)
                  </span>
                  <button
                    onClick={abrirCobrar}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    Ver comanda / Cobrar →
                  </button>
                </div>
              )}
              <ProductGrid categorias={categorias} productos={productos} />
            </>
          ) : view === 'cobrar' ? (
            /* ── Vista cobrar ── */
            <ComandaView
              items={store.pedidoActivoItems}
              total={store.pedidoActivoTotal}
              mesaNumero={mesaActual?.numero ?? null}
              clienteNombre={store.clienteNombre}
              onCobrar={abrirCobrar}
            />
          ) : null}
        </div>
      </div>

      {/* ── Panel derecho: carrito ── */}
      {view !== 'cobrar' && (
        <div className="w-80 shrink-0">
          <Cart
            onEnviar={enviarPedido}
            submitting={submitting}
            hayPedidoActivo={hayPedidoActivo}
            pedidoActivoTotal={store.pedidoActivoTotal}
            onCobrar={abrirCobrar}
          />
        </div>
      )}

      {/* ── Dialog Ticket Cocina ── */}
      <Dialog open={ticketOpen} onOpenChange={(v) => !v && setTicketOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ticket para cocina</DialogTitle>
          </DialogHeader>

          {/* Selector de tamaño de papel */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Papel:</span>
            {(['80mm', '58mm'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setPaperSize(size)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                  paperSize === size
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-border text-muted-foreground hover:border-gray-500 hover:text-foreground'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Preview del ticket */}
          {ticketData && (
            <div
              ref={ticketRef}
              className="font-mono bg-white text-black rounded-lg border-2 border-dashed border-gray-400 p-4 space-y-2 text-sm"
            >
              {/* Cabecera */}
              <div className="text-center border-b-2 border-dashed border-black pb-2 mb-3">
                <div className="text-base font-bold tracking-widest uppercase">
                  {ticketData.esAgregado ? '++ ADICIONAL' : 'COMANDA'}
                </div>
                <div className="text-xs mt-1 font-medium">
                  {ticketData.mesa ? `MESA ${ticketData.mesa}` : 'SIN MESA'} — {ticketData.hora}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {ticketData.items.map((item, i) => (
                  <div key={i} className="border-b border-dashed border-gray-300 pb-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold leading-tight w-8 shrink-0">{item.cantidad}x</span>
                      <span className="text-base font-bold leading-tight">{item.nombre}</span>
                    </div>
                    {item.notas && (
                      <div className="mt-1 ml-2 inline-block bg-black text-white text-xs font-bold px-2 py-0.5 rounded">
                        ! {item.notas}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pie */}
              <div className="text-center text-xs text-gray-500 pt-1 border-t border-dashed border-gray-300">
                {new Date().toLocaleDateString('es-PE')}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setTicketOpen(false)} className="flex-1">
              Cerrar
            </Button>
            <Button
              onClick={imprimirTicket}
              className="flex-1 bg-gray-900 hover:bg-gray-700 text-white"
            >
              🖨️ Imprimir {paperSize}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Cobrar ── */}
      <Dialog open={cobrarOpen} onOpenChange={(v) => !v && setCobrarOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Cobrar — Mesa {mesaActual?.numero}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Items de la comanda */}
            <ScrollArea className="max-h-48">
              <div className="space-y-1 pr-2">
                {comandaItems.map((item, i) => (
                  <div key={item.id ?? i} className="flex justify-between text-sm py-1 border-b border-border">
                    <span className="text-foreground">{item.nombre} <span className="text-muted-foreground">×{item.cantidad}</span></span>
                    <span className="text-foreground font-medium">S/ {(item.precio_unit * item.cantidad).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center py-2 border-t border-border">
              <span className="text-foreground font-semibold">Total a cobrar</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                S/ {comandaTotal.toFixed(2)}
              </span>
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Cliente <span className="text-muted-foreground font-normal">(opcional)</span></p>

              {store.clienteId ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">✓ {store.clienteNombre}</span>
                  <button
                    onClick={() => { store.setCliente(null, ''); setClienteSearch('') }}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    Quitar
                  </button>
                </div>
              ) : creandoCliente ? (
                <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Input
                    placeholder="Nombre *"
                    value={nuevoCliente.nombre}
                    onChange={(e) => setNuevoCliente((p) => ({ ...p, nombre: e.target.value }))}
                  />
                  <Input
                    placeholder="DNI / RUC (opcional)"
                    value={nuevoCliente.dni_ruc}
                    onChange={(e) => setNuevoCliente((p) => ({ ...p, dni_ruc: e.target.value }))}
                  />
                  <Input
                    placeholder="Teléfono (opcional)"
                    value={nuevoCliente.telefono}
                    onChange={(e) => setNuevoCliente((p) => ({ ...p, telefono: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={crearCliente} className="flex-1">Guardar cliente</Button>
                    <Button size="sm" variant="outline" onClick={() => setCreandoCliente(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar por nombre, DNI o teléfono…"
                      value={clienteSearch}
                      onChange={(e) => buscarCliente(e.target.value)}
                    />
                    <Button size="sm" variant="outline" onClick={() => setCreandoCliente(true)}>
                      + Nuevo
                    </Button>
                  </div>
                  {clienteResults.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      {clienteResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { store.setCliente(c.id, c.nombre); setClienteSearch(''); setClienteResults([]) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                        >
                          <span className="text-foreground font-medium">{c.nombre}</span>
                          {c.dni_ruc && <span className="text-muted-foreground ml-2 text-xs">{c.dni_ruc}</span>}
                          {c.telefono && <span className="text-muted-foreground ml-2 text-xs">{c.telefono}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {clienteSearch.length >= 2 && clienteResults.length === 0 && (
                    <p className="text-muted-foreground text-xs">Sin resultados — <button onClick={() => setCreandoCliente(true)} className="text-primary underline">crear nuevo</button></p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {creandoCliente && nuevoCliente.nombre.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-400 self-center mr-auto">
                ⚠️ Se guardará el cliente antes de cobrar
              </p>
            )}
            <Button variant="outline" onClick={() => setCobrarOpen(false)}>Cancelar</Button>
            <Button
              onClick={confirmarCobro}
              disabled={cobrando}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              size="lg"
            >
              {cobrando ? 'Procesando…' : `Cobrar S/ ${comandaTotal.toFixed(2)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Sub-componente ComandaView ── */
function ComandaView({
  items, total, mesaNumero, clienteNombre, onCobrar,
}: {
  items: PedidoItemDetalle[]
  total: number
  mesaNumero: number | null
  clienteNombre: string
  onCobrar: () => void
}) {
  const estadoBadge: Record<string, string> = {
    pendiente: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
    preparando: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
    listo: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    entregado: 'bg-gray-500/20 text-gray-600 dark:text-gray-300',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground font-semibold">
          Comanda activa {mesaNumero ? `— Mesa ${mesaNumero}` : ''}
        </h2>
        {clienteNombre && (
          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500">
            Cliente: {clienteNombre}
          </Badge>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-left">
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 font-medium text-center">Cant.</th>
              <th className="px-4 py-2 font-medium text-right">Precio</th>
              <th className="px-4 py-2 font-medium text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, i) => (
              <tr key={item.id ?? i} className="bg-card">
                <td className="px-4 py-2 text-foreground">{item.nombre}</td>
                <td className="px-4 py-2 text-center text-muted-foreground">{item.cantidad}</td>
                <td className="px-4 py-2 text-right text-foreground">S/ {(item.precio_unit * item.cantidad).toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  <Badge className={`text-xs capitalize border-0 ${estadoBadge[item.estado] ?? ''}`}>
                    {item.estado}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30">
              <td colSpan={2} className="px-4 py-3 text-foreground font-semibold">Total</td>
              <td colSpan={2} className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                S/ {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Button
        onClick={onCobrar}
        size="lg"
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        💰 Cobrar S/ {total.toFixed(2)}
      </Button>
    </div>
  )
}
