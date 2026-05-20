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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { Mesa, Salon } from '@/types/supabase'

/* ─── Schemas ─── */
const salonSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
})
const mesaSchema = z.object({
  salon_id: z.string().min(1, 'Selecciona un salón'),
  numero: z.number().int().positive('Número inválido'),
  estado: z.enum(['libre', 'ocupada', 'reservada']),
})
type SalonForm = z.infer<typeof salonSchema>
type MesaForm = z.infer<typeof mesaSchema>

/* ─── Props ─── */
type Props = {
  salones: Salon[]
  mesas: Mesa[]
  tenantId: string
}

const estadoColors = {
  libre: 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300',
  ocupada: 'bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-300',
  reservada: 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300',
}

/* ─── Component ─── */
export function MesasClient({ salones: initSalones, mesas: initMesas, tenantId }: Props) {
  const supabase = createClient()
  const [salones, setSalones] = useState(initSalones)
  const [mesas, setMesas] = useState(initMesas)

  const [salonDialog, setSalonDialog] = useState<{ open: boolean; editando: Salon | null }>({ open: false, editando: null })
  const [mesaDialog, setMesaDialog] = useState<{ open: boolean; editando: Mesa | null }>({ open: false, editando: null })
  const [confirmDel, setConfirmDel] = useState<{ tipo: 'salon' | 'mesa'; id: string } | null>(null)

  /* ── Salón ── */
  const salonForm = useForm<SalonForm>({
    resolver: zodResolver(salonSchema),
    defaultValues: { nombre: '' },
  })

  function openSalonDialog(salon?: Salon) {
    salonForm.reset(salon ? { nombre: salon.nombre } : { nombre: '' })
    setSalonDialog({ open: true, editando: salon ?? null })
  }

  async function submitSalon(data: SalonForm) {
    if (salonDialog.editando) {
      const { data: updated, error } = await supabase
        .from('salones').update(data).eq('id', salonDialog.editando.id).select().single()
      if (error) { toast.error('Error al actualizar salón'); return }
      setSalones((p) => p.map((s) => s.id === salonDialog.editando!.id ? updated as Salon : s))
      toast.success('Salón actualizado')
    } else {
      const orden = salones.length + 1
      const { data: created, error } = await supabase
        .from('salones').insert({ ...data, tenant_id: tenantId, orden }).select().single()
      if (error) { toast.error('Error al crear salón'); return }
      setSalones((p) => [...p, created as Salon])
      toast.success('Salón creado')
    }
    setSalonDialog({ open: false, editando: null })
  }

  async function deleteSalon(id: string) {
    const { error } = await supabase.from('salones').delete().eq('id', id)
    if (error) { toast.error('No se puede eliminar (tiene mesas asociadas)'); return }
    setSalones((p) => p.filter((s) => s.id !== id))
    setMesas((p) => p.filter((m) => m.salon_id !== id))
    toast.success('Salón eliminado')
  }

  /* ── Mesa ── */
  const mesaForm = useForm<MesaForm>({
    resolver: zodResolver(mesaSchema),
    defaultValues: { salon_id: '', numero: 1, estado: 'libre' },
  })

  function openMesaDialog(mesa?: Mesa) {
    mesaForm.reset(mesa
      ? { salon_id: mesa.salon_id, numero: mesa.numero, estado: mesa.estado }
      : { salon_id: salones[0]?.id ?? '', numero: 1, estado: 'libre' }
    )
    setMesaDialog({ open: true, editando: mesa ?? null })
  }

  async function submitMesa(data: MesaForm) {
    if (mesaDialog.editando) {
      const { data: updated, error } = await supabase
        .from('mesas').update(data).eq('id', mesaDialog.editando.id).select().single()
      if (error) { toast.error('Error al actualizar mesa'); return }
      setMesas((p) => p.map((m) => m.id === mesaDialog.editando!.id ? updated as Mesa : m))
      toast.success('Mesa actualizada')
    } else {
      const { data: created, error } = await supabase
        .from('mesas').insert({ ...data, tenant_id: tenantId }).select().single()
      if (error) { toast.error('Error al crear mesa'); return }
      setMesas((p) => [...p, created as Mesa])
      toast.success('Mesa creada')
    }
    setMesaDialog({ open: false, editando: null })
  }

  async function deleteMesa(id: string) {
    const { error } = await supabase.from('mesas').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar mesa'); return }
    setMesas((p) => p.filter((m) => m.id !== id))
    toast.success('Mesa eliminada')
  }

  const libres = mesas.filter((m) => m.estado === 'libre').length
  const ocupadas = mesas.filter((m) => m.estado === 'ocupada').length

  /* ─── UI ─── */
  return (
    <div className="space-y-6">
      <Tabs defaultValue="mesas">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-2xl font-bold">Mesas</h1>
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500">{libres} libres</Badge>
            <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500">{ocupadas} ocupadas</Badge>
          </div>
          <TabsList>
            <TabsTrigger value="mesas">Mesas ({mesas.length})</TabsTrigger>
            <TabsTrigger value="salones">Salones ({salones.length})</TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB MESAS ── */}
        <TabsContent value="mesas" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openMesaDialog()} disabled={salones.length === 0}>+ Nueva mesa</Button>
          </div>
          {salones.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Crea un salón primero</p>
          )}
          {salones.map((salon) => {
            const mesasSalon = mesas.filter((m) => m.salon_id === salon.id)
            return (
              <div key={salon.id}>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">{salon.nombre}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
                  {mesasSalon.map((mesa) => (
                    <div
                      key={mesa.id}
                      className={cn('aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 relative group', estadoColors[mesa.estado])}
                    >
                      <span className="font-bold text-xl">{mesa.numero}</span>
                      <span className="text-xs capitalize">{mesa.estado}</span>
                      <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                          onClick={() => openMesaDialog(mesa)}
                          className="text-white text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                        >✏️</button>
                        <button
                          onClick={() => setConfirmDel({ tipo: 'mesa', id: mesa.id })}
                          className="text-white text-xs px-2 py-1 rounded bg-red-500/60 hover:bg-red-500/80"
                        >🗑️</button>
                      </div>
                    </div>
                  ))}
                  {mesasSalon.length === 0 && (
                    <p className="text-muted-foreground text-sm col-span-full">Sin mesas</p>
                  )}
                </div>
              </div>
            )
          })}
        </TabsContent>

        {/* ── TAB SALONES ── */}
        <TabsContent value="salones" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openSalonDialog()}>+ Nuevo salón</Button>
          </div>
          <div className="space-y-2">
            {salones.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div>
                  <p className="text-foreground font-medium">{s.nombre}</p>
                  <p className="text-muted-foreground text-xs">{mesas.filter((m) => m.salon_id === s.id).length} mesas</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openSalonDialog(s)}>Editar</Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmDel({ tipo: 'salon', id: s.id })}>Eliminar</Button>
                </div>
              </div>
            ))}
            {salones.length === 0 && <p className="text-muted-foreground text-center py-12">Sin salones</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── DIALOG SALÓN ── */}
      <Dialog open={salonDialog.open} onOpenChange={(v) => !v && setSalonDialog({ open: false, editando: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{salonDialog.editando ? 'Editar salón' : 'Nuevo salón'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salonForm.handleSubmit(submitSalon)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input placeholder="Ej: Terraza, Interior…" {...salonForm.register('nombre')} />
              {salonForm.formState.errors.nombre && <p className="text-red-500 text-xs">{salonForm.formState.errors.nombre.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSalonDialog({ open: false, editando: null })}>Cancelar</Button>
              <Button type="submit" disabled={salonForm.formState.isSubmitting}>
                {salonForm.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG MESA ── */}
      <Dialog open={mesaDialog.open} onOpenChange={(v) => !v && setMesaDialog({ open: false, editando: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{mesaDialog.editando ? 'Editar mesa' : 'Nueva mesa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={mesaForm.handleSubmit(submitMesa)} className="space-y-4">
            <div className="space-y-1">
              <Label>Salón</Label>
              <Select value={mesaForm.watch('salon_id')} onValueChange={(v) => mesaForm.setValue('salon_id', v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {salones.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {mesaForm.formState.errors.salon_id && <p className="text-red-500 text-xs">{mesaForm.formState.errors.salon_id.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Número de mesa</Label>
              <Input type="number" min={1} {...mesaForm.register('numero', { valueAsNumber: true })} />
              {mesaForm.formState.errors.numero && <p className="text-red-500 text-xs">{mesaForm.formState.errors.numero.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={mesaForm.watch('estado')} onValueChange={(v) => mesaForm.setValue('estado', v as Mesa['estado'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="libre">🟢 Libre</SelectItem>
                  <SelectItem value="ocupada">🟠 Ocupada</SelectItem>
                  <SelectItem value="reservada">🔵 Reservada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMesaDialog({ open: false, editando: null })}>Cancelar</Button>
              <Button type="submit" disabled={mesaForm.formState.isSubmitting}>
                {mesaForm.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE ── */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar {confirmDel?.tipo === 'salon' ? 'salón' : 'mesa'}?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirmDel) return
              if (confirmDel.tipo === 'salon') await deleteSalon(confirmDel.id)
              else await deleteMesa(confirmDel.id)
              setConfirmDel(null)
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
