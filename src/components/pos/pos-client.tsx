'use client'
import { useState } from 'react'
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

  /* ── Enviar a cocina ── */
  async function enviarPedido() {
    if (store.cart.length === 0) { toast.error('El carrito está vacío'); return }
    setSubmitting(true)

    try {
      if (store.pedidoActivoId) {
        /* ─ AGREGAR a pedido existente ─ */
        const itemsInsert = store.cart.map((i) => ({
          pedido_id: store.pedidoActivoId!,
          producto_id: i.producto.id,
          cantidad: i.cantidad,
          precio_unit: Number(i.producto.precio_salon),
          descuento: 0,
          notas: i.notas ?? null,
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

  /* ── Crear cliente nuevo ── */
  async function crearCliente() {
    if (!nuevoCliente.nombre) { toast.error('El nombre es obligatorio'); return }
    const { data, error } = await supabase
      .from('clientes')
      .insert({ tenant_id: tenantId, nombre: nuevoCliente.nombre, dni_ruc: nuevoCliente.dni_ruc || null, telefono: nuevoCliente.telefono || null })
      .select().single()
    if (error) { toast.error(`Error: ${error.message}`); return }
    store.setCliente(data.id, data.nombre)
    setCreandoCliente(false)
    toast.success('Cliente registrado')
  }

  /* ── Confirmar cobro ── */
  async function confirmarCobro() {
    if (!store.pedidoActivoId) return
    setCobrando(true)
    try {
      /* Marcar pedido como entregado */
      await supabase
        .from('pedidos')
        .update({ estado: 'entregado', ...(store.clienteId ? { cliente_id: store.clienteId } : {}) })
        .eq('id', store.pedidoActivoId)

      /* Marcar mesa como libre */
      await supabase.from('mesas').update({ estado: 'libre' }).eq('id', store.mesaId)

      /* Dar puntos al cliente si hay uno */
      if (store.clienteId) {
        const { data: cli } = await supabase.from('clientes').select('puntos').eq('id', store.clienteId).single()
        if (cli) {
          const puntosGanados = Math.floor(comandaTotal)
          await supabase.from('clientes').update({ puntos: (cli.puntos ?? 0) + puntosGanados }).eq('id', store.clienteId)
        }
      }

      /* Actualizar lista local */
      setMesas((prev) =>
        prev.map((m) => m.id === store.mesaId ? { ...m, estado: 'libre' as const } : m)
      )

      toast.success(`Cobro confirmado — S/ ${comandaTotal.toFixed(2)} ✓`)
      setCobrarOpen(false)
      store.clearAll()
      setView('mesas')
      router.refresh()
    } catch (err) {
      toast.error('Error al confirmar cobro')
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

          <DialogFooter className="gap-2">
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
