'use client'
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Proveedor, Insumo } from '@/types/supabase'

/* ─── Types ─── */
type CompraItem = { id: string; insumo_id: string; cantidad: number; precio_unit: number }
type CompraConDetalle = {
  id: string
  tenant_id: string
  proveedor_id: string
  total: number
  estado: string
  fecha: string
  proveedor: { nombre: string } | null
  items?: CompraItem[]
}

/* ─── Schema ─── */
const itemSchema = z.object({
  insumo_id: z.string().min(1, 'Selecciona un insumo'),
  cantidad: z.number({ error: 'Ingresa una cantidad válida' }).positive('Debe ser mayor a 0'),
  precio_unit: z.number({ error: 'Ingresa un precio válido' }).positive('Debe ser mayor a 0'),
})
const compraSchema = z.object({
  proveedor_id: z.string().min(1, 'Selecciona un proveedor'),
  fecha: z.string().min(1, 'Ingresa la fecha'),
  items: z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
})
type CompraForm = z.infer<typeof compraSchema>

/* ─── Props ─── */
type Props = {
  compras: CompraConDetalle[]
  proveedores: Proveedor[]
  insumos: Insumo[]
  tenantId: string
}

const estadoStyle: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500',
  recibida: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500',
  cancelada: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500',
}

export function ComprasClient({ compras: initCompras, proveedores, insumos, tenantId }: Props) {
  const supabase = createClient()
  const [compras, setCompras] = useState(initCompras)
  const [crearOpen, setCrearOpen] = useState(false)
  const [detalle, setDetalle] = useState<CompraConDetalle | null>(null)

  /* ── form ── */
  const form = useForm<CompraForm>({
    resolver: zodResolver(compraSchema),
    defaultValues: {
      proveedor_id: '',
      fecha: new Date().toISOString().slice(0, 16),
      items: [{ insumo_id: '', cantidad: 1, precio_unit: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  /* total calculado */
  const watchedItems = form.watch('items')
  const totalCalculado = watchedItems.reduce(
    (sum, i) => sum + (Number(i.cantidad) || 0) * (Number(i.precio_unit) || 0),
    0
  )

  function abrirCrear() {
    form.reset({
      proveedor_id: '',
      fecha: new Date().toISOString().slice(0, 16),
      items: [{ insumo_id: '', cantidad: 1, precio_unit: 0 }],
    })
    setCrearOpen(true)
  }

  async function submitCompra(data: CompraForm) {
    const total = data.items.reduce(
      (s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0
    )

    /* 1. Crear compra */
    const { data: compra, error: errCompra } = await supabase
      .from('compras')
      .insert({ tenant_id: tenantId, proveedor_id: data.proveedor_id, total, estado: 'pendiente', fecha: data.fecha })
      .select()
      .single()
    if (errCompra) { toast.error(`Error al crear compra: ${errCompra.message}`); return }

    /* 2. Insertar ítems */
    const { error: errItems } = await supabase.from('compra_items').insert(
      data.items.map((i) => ({
        compra_id: compra.id,
        insumo_id: i.insumo_id,
        cantidad: Number(i.cantidad),
        precio_unit: Number(i.precio_unit),
      }))
    )
    if (errItems) { toast.error(`Error al guardar ítems: ${errItems.message}`); return }

    /* 3. Agregar a estado local */
    const proveedor = proveedores.find((p) => p.id === data.proveedor_id) ?? null
    const nuevaCompra: CompraConDetalle = {
      ...(compra as CompraConDetalle),
      proveedor: proveedor ? { nombre: proveedor.nombre } : null,
      items: data.items.map((i, idx) => ({
        id: `tmp-${idx}`,
        insumo_id: i.insumo_id,
        cantidad: Number(i.cantidad),
        precio_unit: Number(i.precio_unit),
      })),
    }
    setCompras((p) => [nuevaCompra, ...p])
    toast.success('Compra registrada')
    setCrearOpen(false)
  }

  async function marcarRecibida(compra: CompraConDetalle) {
    /* Actualizar estado */
    const { error } = await supabase
      .from('compras').update({ estado: 'recibida' }).eq('id', compra.id)
    if (error) { toast.error(`Error: ${error.message}`); return }

    /* Cargar ítems si no los tenemos */
    let items = compra.items
    if (!items || items.length === 0) {
      const { data } = await supabase.from('compra_items').select('*').eq('compra_id', compra.id)
      items = (data ?? []) as CompraItem[]
    }

    /* Actualizar stock de cada insumo */
    for (const item of items) {
      const insumo = insumos.find((i) => i.id === item.insumo_id)
      if (!insumo) continue
      const nuevoStock = Number(insumo.stock_actual) + Number(item.cantidad)
      await supabase.from('insumos').update({ stock_actual: nuevoStock }).eq('id', item.insumo_id)
      await supabase.from('movimientos_stock').insert({
        tenant_id: tenantId,
        insumo_id: item.insumo_id,
        tipo: 'entrada',
        cantidad: Number(item.cantidad),
        origen: 'compra',
        ref_id: compra.id,
      })
    }

    setCompras((p) => p.map((c) => c.id === compra.id ? { ...c, estado: 'recibida' } : c))
    if (detalle?.id === compra.id) setDetalle((d) => d ? { ...d, estado: 'recibida' } : d)
    toast.success('Compra marcada como recibida y stock actualizado')
  }

  async function marcarCancelada(compraId: string) {
    const { error } = await supabase.from('compras').update({ estado: 'cancelada' }).eq('id', compraId)
    if (error) { toast.error(`Error: ${error.message}`); return }
    setCompras((p) => p.map((c) => c.id === compraId ? { ...c, estado: 'cancelada' } : c))
    if (detalle?.id === compraId) setDetalle((d) => d ? { ...d, estado: 'cancelada' } : d)
    toast.success('Compra cancelada')
  }

  async function abrirDetalle(compra: CompraConDetalle) {
    let items = compra.items
    if (!items || items.length === 0) {
      const { data } = await supabase.from('compra_items').select('*').eq('compra_id', compra.id)
      items = (data ?? []) as CompraItem[]
    }
    setDetalle({ ...compra, items })
  }

  /* ─── UI ─── */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-bold">Compras</h1>
        <Button onClick={abrirCrear}>+ Nueva compra</Button>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compras.map((c) => (
              <tr key={c.id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {format(new Date(c.fecha), 'dd MMM yyyy HH:mm', { locale: es })}
                </td>
                <td className="px-4 py-3 text-foreground font-medium">{c.proveedor?.nombre ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  S/ {Number(c.total).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <Badge className={`capitalize border text-xs ${estadoStyle[c.estado] ?? 'bg-muted text-muted-foreground'}`}>
                    {c.estado}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => abrirDetalle(c)}>
                      Ver
                    </Button>
                    {c.estado === 'pendiente' && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-emerald-600 border-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => marcarRecibida(c)}>
                          Recibida
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => marcarCancelada(c.id)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {compras.length === 0 && (
          <div className="text-muted-foreground text-center py-16">Sin compras registradas.</div>
        )}
      </div>

      {/* ── DIALOG CREAR COMPRA ── */}
      <Dialog open={crearOpen} onOpenChange={(v) => !v && setCrearOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva compra</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submitCompra)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Proveedor */}
              <div className="space-y-1">
                <Label>Proveedor</Label>
                <Select
                  value={form.watch('proveedor_id')}
                  onValueChange={(v) => form.setValue('proveedor_id', v ?? '')}
                >
                  <SelectTrigger>
                    <span className="truncate text-sm">
                      {proveedores.find((p) => p.id === form.watch('proveedor_id'))?.nombre
                        ?? <span className="text-muted-foreground">Selecciona…</span>}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.proveedor_id && (
                  <p className="text-red-500 text-xs">{form.formState.errors.proveedor_id.message}</p>
                )}
              </div>
              {/* Fecha */}
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="datetime-local" {...form.register('fecha')} />
                {form.formState.errors.fecha && (
                  <p className="text-red-500 text-xs">{form.formState.errors.fecha.message}</p>
                )}
              </div>
            </div>

            {/* Ítems */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ítems</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => append({ insumo_id: '', cantidad: 1, precio_unit: 0 })}>
                  + Agregar ítem
                </Button>
              </div>
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-2">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="grid grid-cols-[1fr_80px_90px_32px] gap-2 items-start">
                      {/* Insumo */}
                      <div>
                        <Select
                          value={form.watch(`items.${idx}.insumo_id`)}
                          onValueChange={(v) => form.setValue(`items.${idx}.insumo_id`, v ?? '')}
                        >
                          <SelectTrigger className="h-8">
                            <span className="truncate text-xs">
                              {insumos.find((i) => i.id === form.watch(`items.${idx}.insumo_id`))?.nombre
                                ?? <span className="text-muted-foreground">Insumo…</span>}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {insumos.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.nombre} ({i.unidad})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.items?.[idx]?.insumo_id && (
                          <p className="text-red-500 text-xs mt-0.5">
                            {form.formState.errors.items[idx]?.insumo_id?.message}
                          </p>
                        )}
                      </div>
                      {/* Cantidad */}
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Cant."
                        {...form.register(`items.${idx}.cantidad`, { valueAsNumber: true })}
                      />
                      {/* Precio unit */}
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="P. unit"
                        {...form.register(`items.${idx}.precio_unit`, { valueAsNumber: true })}
                      />
                      {/* Eliminar */}
                      <Button type="button" size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => fields.length > 1 && remove(idx)}
                        disabled={fields.length <= 1}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {form.formState.errors.items?.root && (
                <p className="text-red-500 text-xs">{form.formState.errors.items.root.message}</p>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-muted-foreground text-xs">Total estimado</p>
                <p className="text-foreground text-xl font-bold">S/ {totalCalculado.toFixed(2)}</p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCrearOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando…' : 'Registrar compra'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG DETALLE ── */}
      <Dialog open={!!detalle} onOpenChange={(v) => !v && setDetalle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de compra</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Proveedor</p>
                  <p className="text-foreground font-medium">{detalle.proveedor?.nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fecha</p>
                  <p className="text-foreground font-medium">
                    {format(new Date(detalle.fecha), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Estado</p>
                  <Badge className={`capitalize border text-xs ${estadoStyle[detalle.estado] ?? 'bg-muted text-muted-foreground'}`}>
                    {detalle.estado}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold">
                    S/ {Number(detalle.total).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">Ítems</p>
                <div className="space-y-1">
                  {(detalle.items ?? []).map((item, i) => {
                    const insumo = insumos.find((ins) => ins.id === item.insumo_id)
                    return (
                      <div key={item.id ?? i} className="flex items-center justify-between text-sm border-b border-border pb-1">
                        <span className="text-foreground">{insumo?.nombre ?? item.insumo_id}</span>
                        <span className="text-muted-foreground text-xs">
                          {Number(item.cantidad)} {insumo?.unidad ?? ''} × S/ {Number(item.precio_unit).toFixed(2)}
                          {' '}= <span className="text-foreground font-medium">S/ {(Number(item.cantidad) * Number(item.precio_unit)).toFixed(2)}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Acciones */}
              {detalle.estado === 'pendiente' && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => marcarRecibida(detalle)}>
                    Marcar como recibida
                  </Button>
                  <Button variant="outline" className="text-red-500 border-red-500 hover:bg-red-500/10"
                    onClick={() => marcarCancelada(detalle.id)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalle(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
