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
import type { Sucursal } from '@/types/supabase'

/* ─── Schema ─── */
const schema = z.object({
  nombre:    z.string().min(2, 'Mínimo 2 caracteres'),
  direccion: z.string().optional(),
  telefono:  z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  es_principal: z.boolean(),
})
type Form = z.infer<typeof schema>

type Props = { sucursales: Sucursal[]; tenantId: string }

export function SucursalesClient({ sucursales: init, tenantId }: Props) {
  const supabase = createClient()
  const [sucursales, setSucursales] = useState(init)
  const [dialog, setDialog] = useState<{ open: boolean; editando: Sucursal | null }>({ open: false, editando: null })
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', direccion: '', telefono: '', email: '', es_principal: false },
  })

  function openDialog(suc?: Sucursal) {
    form.reset(suc ? {
      nombre: suc.nombre, direccion: suc.direccion ?? '',
      telefono: suc.telefono ?? '', email: suc.email ?? '',
      es_principal: suc.es_principal,
    } : { nombre: '', direccion: '', telefono: '', email: '', es_principal: false })
    setDialog({ open: true, editando: suc ?? null })
  }

  async function onSubmit(data: Form) {
    const payload = {
      nombre: data.nombre,
      direccion: data.direccion || null,
      telefono: data.telefono || null,
      email: data.email || null,
      es_principal: data.es_principal,
    }

    if (dialog.editando) {
      const { data: updated, error } = await supabase
        .from('sucursales').update(payload).eq('id', dialog.editando.id).select().single()
      if (error) { toast.error(`Error: ${error.message}`); return }
      /* Si se marca como principal, desmarcar el resto */
      if (data.es_principal) {
        await supabase.from('sucursales')
          .update({ es_principal: false })
          .eq('tenant_id', tenantId)
          .neq('id', dialog.editando.id)
        setSucursales((p) => p.map((s) =>
          s.id === dialog.editando!.id ? updated as Sucursal : { ...s, es_principal: false }
        ))
      } else {
        setSucursales((p) => p.map((s) => s.id === dialog.editando!.id ? updated as Sucursal : s))
      }
      toast.success('Sucursal actualizada')
    } else {
      const { data: created, error } = await supabase
        .from('sucursales').insert({ ...payload, tenant_id: tenantId }).select().single()
      if (error) { toast.error(`Error: ${error.message}`); return }
      if (data.es_principal) {
        await supabase.from('sucursales')
          .update({ es_principal: false })
          .eq('tenant_id', tenantId)
          .neq('id', (created as Sucursal).id)
        setSucursales((p) => [...p.map((s) => ({ ...s, es_principal: false })), created as Sucursal])
      } else {
        setSucursales((p) => [...p, created as Sucursal])
      }
      toast.success('Sucursal creada')
    }
    setDialog({ open: false, editando: null })
  }

  async function toggleActivo(suc: Sucursal) {
    const { error } = await supabase.from('sucursales').update({ activo: !suc.activo }).eq('id', suc.id)
    if (error) { toast.error(`Error: ${error.message}`); return }
    setSucursales((p) => p.map((s) => s.id === suc.id ? { ...s, activo: !suc.activo } : s))
    toast.success(suc.activo ? 'Sucursal desactivada' : 'Sucursal activada')
  }

  async function deleteSucursal(id: string) {
    const suc = sucursales.find((s) => s.id === id)
    if (suc?.es_principal) { toast.error('No puedes eliminar la sucursal principal'); return }
    const { error } = await supabase.from('sucursales').delete().eq('id', id)
    if (error) { toast.error(`Error: ${error.message}`); return }
    setSucursales((p) => p.filter((s) => s.id !== id))
    toast.success('Sucursal eliminada')
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Sucursales</h1>
          <p className="text-muted-foreground text-sm mt-1">{sucursales.length} sucursal(es) registrada(s)</p>
        </div>
        <Button onClick={() => openDialog()}>+ Nueva sucursal</Button>
      </div>

      <div className="space-y-3">
        {sucursales.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-4xl mb-3">🏪</p>
            <p>No tienes sucursales registradas</p>
          </div>
        ) : sucursales.map((suc) => (
          <div
            key={suc.id}
            className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl border ${
              suc.activo ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'
            }`}
          >
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-foreground font-semibold">{suc.nombre}</p>
                {suc.es_principal && (
                  <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400 text-xs">
                    Principal
                  </Badge>
                )}
                {!suc.activo && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Inactiva</Badge>
                )}
              </div>
              {suc.direccion && (
                <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                  📍 {suc.direccion}
                </p>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                {suc.telefono && (
                  <span className="text-muted-foreground text-xs flex items-center gap-1">📞 {suc.telefono}</span>
                )}
                {suc.email && (
                  <span className="text-muted-foreground text-xs flex items-center gap-1">✉️ {suc.email}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-8" onClick={() => openDialog(suc)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-muted-foreground"
                onClick={() => toggleActivo(suc)}
              >
                {suc.activo ? 'Desactivar' : 'Activar'}
              </Button>
              {!suc.es_principal && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-red-500 hover:text-red-600"
                  onClick={() => setConfirmDel(suc.id)}
                >
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Dialog Crear/Editar ── */}
      <Dialog open={dialog.open} onOpenChange={(v) => !v && setDialog({ open: false, editando: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.editando ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Ej: Sede Miraflores, Local Centro…" {...form.register('nombre')} />
              {form.formState.errors.nombre && <p className="text-red-500 text-xs">{form.formState.errors.nombre.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input placeholder="Av. Ejemplo 456, Lima" {...form.register('direccion')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="01 234 5678" {...form.register('telefono')} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="local@email.com" {...form.register('email')} />
                {form.formState.errors.email && <p className="text-red-500 text-xs">{form.formState.errors.email.message}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <input
                type="checkbox"
                id="es_principal"
                className="w-4 h-4 accent-primary"
                {...form.register('es_principal')}
              />
              <div>
                <Label htmlFor="es_principal" className="cursor-pointer font-medium">Sucursal principal</Label>
                <p className="text-muted-foreground text-xs">Esta será la sede principal del negocio</p>
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

      {/* ── Dialog Confirmar eliminar ── */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar sucursal?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (confirmDel) await deleteSucursal(confirmDel)
              setConfirmDel(null)
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
