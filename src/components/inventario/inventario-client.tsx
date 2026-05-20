'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Insumo } from '@/types/supabase'

type Unidad = 'kg' | 'lt' | 'und' | 'gr' | 'ml'

/* ─── Schemas ─── */
const insumoSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  unidad: z.enum(['kg', 'lt', 'und', 'gr', 'ml']),
  stock_minimo: z.number().min(0, 'Debe ser ≥ 0'),
  costo_unit: z.number().min(0, 'Debe ser ≥ 0'),
})
const ajusteSchema = z.object({
  cantidad: z.number().positive('Debe ser mayor a 0'),
  tipo: z.enum(['entrada', 'salida', 'ajuste', 'merma']),
})
type InsumoForm = z.infer<typeof insumoSchema>
type AjusteForm = z.infer<typeof ajusteSchema>

/* ─── Props ─── */
type Props = {
  insumos: Insumo[]
  tenantId: string
}

/* ─── Component ─── */
export function InventarioClient({ insumos: initInsumos, tenantId }: Props) {
  const supabase = createClient()
  const [insumos, setInsumos] = useState(initInsumos)
  const [dialog, setDialog] = useState<{ open: boolean; editando: Insumo | null }>({ open: false, editando: null })
  const [ajusteDialog, setAjusteDialog] = useState<{ open: boolean; insumo: Insumo | null }>({ open: false, insumo: null })
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  /* ── Insumo form ── */
  const form = useForm<InsumoForm>({
    resolver: zodResolver(insumoSchema),
    defaultValues: { nombre: '', unidad: 'kg', stock_minimo: 0, costo_unit: 0 },
  })

  function openDialog(insumo?: Insumo) {
    form.reset(insumo
      ? { nombre: insumo.nombre, unidad: insumo.unidad, stock_minimo: Number(insumo.stock_minimo), costo_unit: Number(insumo.costo_unit) }
      : { nombre: '', unidad: 'kg', stock_minimo: 0, costo_unit: 0 }
    )
    setDialog({ open: true, editando: insumo ?? null })
  }

  async function submitInsumo(data: InsumoForm) {
    if (dialog.editando) {
      const { data: updated, error } = await supabase
        .from('insumos').update(data).eq('id', dialog.editando.id).select().single()
      if (error) { toast.error('Error al actualizar'); return }
      setInsumos((p) => p.map((i) => i.id === dialog.editando!.id ? updated as Insumo : i))
      toast.success('Insumo actualizado')
    } else {
      const { data: created, error } = await supabase
        .from('insumos').insert({ ...data, tenant_id: tenantId, stock_actual: 0 }).select().single()
      if (error) { toast.error('Error al crear insumo'); return }
      setInsumos((p) => [...p, created as Insumo])
      toast.success('Insumo creado')
    }
    setDialog({ open: false, editando: null })
  }

  async function deleteInsumo(id: string) {
    const { error } = await supabase.from('insumos').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar insumo'); return }
    setInsumos((p) => p.filter((i) => i.id !== id))
    toast.success('Insumo eliminado')
  }

  /* ── Ajuste stock ── */
  const ajusteForm = useForm<AjusteForm>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: { cantidad: 0, tipo: 'entrada' },
  })

  function openAjuste(insumo: Insumo) {
    ajusteForm.reset({ cantidad: 0, tipo: 'entrada' })
    setAjusteDialog({ open: true, insumo })
  }

  async function submitAjuste(data: AjusteForm) {
    const insumo = ajusteDialog.insumo!
    const delta = data.tipo === 'salida' || data.tipo === 'merma' ? -data.cantidad : data.cantidad
    const nuevoStock = Math.max(0, Number(insumo.stock_actual) + delta)

    const { error: stockError } = await supabase.from('insumos').update({ stock_actual: nuevoStock }).eq('id', insumo.id)
    if (stockError) { toast.error('Error al actualizar stock'); return }

    await supabase.from('movimientos_stock').insert({
      tenant_id: tenantId,
      insumo_id: insumo.id,
      tipo: data.tipo,
      cantidad: data.cantidad,
      origen: 'ajuste_manual',
    })

    setInsumos((p) => p.map((i) => i.id === insumo.id ? { ...i, stock_actual: nuevoStock } : i))
    toast.success(`Stock actualizado: ${nuevoStock} ${insumo.unidad}`)
    setAjusteDialog({ open: false, insumo: null })
  }

  const filtrados = insumos.filter((i) => i.nombre.toLowerCase().includes(search.toLowerCase()))

  /* ─── UI ─── */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-foreground text-2xl font-bold">Inventario</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar insumo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button onClick={() => openDialog()}>+ Nuevo insumo</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Insumo</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium text-right">Stock actual</th>
              <th className="px-4 py-3 font-medium text-right">Stock mínimo</th>
              <th className="px-4 py-3 font-medium text-right">Costo unit.</th>
              <th className="px-4 py-3 font-medium text-center">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.map((insumo) => {
              const bajo = Number(insumo.stock_actual) <= Number(insumo.stock_minimo)
              return (
                <tr key={insumo.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium">{insumo.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{insumo.unidad}</td>
                  <td className={`px-4 py-3 text-right font-medium ${bajo ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                    {Number(insumo.stock_actual).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{Number(insumo.stock_minimo).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">S/ {Number(insumo.costo_unit).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={bajo
                      ? 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500'
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500'
                    }>
                      {bajo ? '⚠ Bajo' : '✓ OK'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openAjuste(insumo)}>Stock</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openDialog(insumo)}>Editar</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => setConfirmDel(insumo.id)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div className="text-muted-foreground text-center py-12">
            {search ? 'Sin resultados' : 'Sin insumos registrados'}
          </div>
        )}
      </div>

      {/* ── DIALOG INSUMO ── */}
      <Dialog open={dialog.open} onOpenChange={(v) => !v && setDialog({ open: false, editando: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog.editando ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submitInsumo)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input placeholder="Ej: Arroz, Aceite…" {...form.register('nombre')} />
              {form.formState.errors.nombre && <p className="text-red-500 text-xs">{form.formState.errors.nombre.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Unidad de medida</Label>
              <Select value={form.watch('unidad')} onValueChange={(v) => form.setValue('unidad', v as Unidad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg — Kilogramos</SelectItem>
                  <SelectItem value="gr">gr — Gramos</SelectItem>
                  <SelectItem value="lt">lt — Litros</SelectItem>
                  <SelectItem value="ml">ml — Mililitros</SelectItem>
                  <SelectItem value="und">und — Unidades</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Stock mínimo</Label>
                <Input type="number" step="0.01" min="0" {...form.register('stock_minimo', { valueAsNumber: true })} />
                {form.formState.errors.stock_minimo && <p className="text-red-500 text-xs">{form.formState.errors.stock_minimo.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Costo unitario (S/)</Label>
                <Input type="number" step="0.01" min="0" {...form.register('costo_unit', { valueAsNumber: true })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog({ open: false, editando: null })}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG AJUSTE STOCK ── */}
      <Dialog open={ajusteDialog.open} onOpenChange={(v) => !v && setAjusteDialog({ open: false, insumo: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar stock — {ajusteDialog.insumo?.nombre}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Stock actual: <span className="text-foreground font-bold">{Number(ajusteDialog.insumo?.stock_actual ?? 0).toFixed(2)} {ajusteDialog.insumo?.unidad}</span>
          </p>
          <form onSubmit={ajusteForm.handleSubmit(submitAjuste)} className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo de movimiento</Label>
              <Select value={ajusteForm.watch('tipo')} onValueChange={(v) => ajusteForm.setValue('tipo', v as AjusteForm['tipo'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">📥 Entrada (suma)</SelectItem>
                  <SelectItem value="salida">📤 Salida (resta)</SelectItem>
                  <SelectItem value="ajuste">🔧 Ajuste (suma)</SelectItem>
                  <SelectItem value="merma">❌ Merma (resta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cantidad ({ajusteDialog.insumo?.unidad})</Label>
              <Input type="number" step="0.01" min="0.01" {...ajusteForm.register('cantidad', { valueAsNumber: true })} />
              {ajusteForm.formState.errors.cantidad && <p className="text-red-500 text-xs">{ajusteForm.formState.errors.cantidad.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAjusteDialog({ open: false, insumo: null })}>Cancelar</Button>
              <Button type="submit" disabled={ajusteForm.formState.isSubmitting}>
                {ajusteForm.formState.isSubmitting ? 'Aplicando…' : 'Aplicar ajuste'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE ── */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar insumo?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirmDel) return
              await deleteInsumo(confirmDel)
              setConfirmDel(null)
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
