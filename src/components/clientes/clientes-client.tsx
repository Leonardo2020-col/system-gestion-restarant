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
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Cliente } from '@/types/supabase'

/* ─── Schema ─── */
const clienteSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  dni_ruc: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  puntos: z.number().min(0, 'No puede ser negativo'),
})
type ClienteForm = z.infer<typeof clienteSchema>

/* ─── Props ─── */
type Props = {
  clientes: Cliente[]
  tenantId: string
}

/* ─── Component ─── */
export function ClientesClient({ clientes: initClientes, tenantId }: Props) {
  const supabase = createClient()
  const [clientes, setClientes] = useState(initClientes)
  const [dialog, setDialog] = useState<{ open: boolean; editando: Cliente | null }>({ open: false, editando: null })
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  /* ── Form ── */
  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { nombre: '', dni_ruc: '', telefono: '', email: '', puntos: 0 },
  })

  function openDialog(cliente?: Cliente) {
    form.reset(cliente
      ? { nombre: cliente.nombre, dni_ruc: cliente.dni_ruc ?? '', telefono: cliente.telefono ?? '', email: cliente.email ?? '', puntos: cliente.puntos }
      : { nombre: '', dni_ruc: '', telefono: '', email: '', puntos: 0 }
    )
    setDialog({ open: true, editando: cliente ?? null })
  }

  async function submitCliente(data: ClienteForm) {
    const payload = {
      nombre: data.nombre,
      dni_ruc: data.dni_ruc || null,
      telefono: data.telefono || null,
      email: data.email || null,
      puntos: data.puntos,
    }
    if (dialog.editando) {
      const { data: updated, error } = await supabase
        .from('clientes').update(payload).eq('id', dialog.editando.id).select().single()
      if (error) { toast.error('Error al actualizar cliente'); return }
      setClientes((p) => p.map((c) => c.id === dialog.editando!.id ? updated as Cliente : c))
      toast.success('Cliente actualizado')
    } else {
      const { data: created, error } = await supabase
        .from('clientes').insert({ ...payload, tenant_id: tenantId }).select().single()
      if (error) { toast.error('Error al crear cliente'); return }
      setClientes((p) => [...p, created as Cliente])
      toast.success('Cliente creado')
    }
    setDialog({ open: false, editando: null })
  }

  async function deleteCliente(id: string) {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar cliente'); return }
    setClientes((p) => p.filter((c) => c.id !== id))
    toast.success('Cliente eliminado')
  }

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.dni_ruc ?? '').includes(search) ||
    (c.telefono ?? '').includes(search)
  )

  /* ─── UI ─── */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-foreground text-2xl font-bold">Clientes</h1>
          <Badge variant="secondary">{clientes.length} registrados</Badge>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre, DNI o tel…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Button onClick={() => openDialog()}>+ Nuevo cliente</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">DNI / RUC</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium text-center">Puntos</th>
              <th className="px-4 py-3 font-medium">Desde</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3 text-foreground font-medium">{c.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.dni_ruc ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.telefono ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500">
                    ⭐ {c.puntos}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {format(new Date(c.created_at), 'dd MMM yyyy', { locale: es })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openDialog(c)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => setConfirmDel(c.id)}>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div className="text-muted-foreground text-center py-12">
            {search ? 'Sin resultados para esa búsqueda' : 'Sin clientes registrados'}
          </div>
        )}
      </div>

      {/* ── DIALOG CLIENTE ── */}
      <Dialog open={dialog.open} onOpenChange={(v) => !v && setDialog({ open: false, editando: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.editando ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submitCliente)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre completo</Label>
              <Input placeholder="Juan García" {...form.register('nombre')} />
              {form.formState.errors.nombre && <p className="text-red-500 text-xs">{form.formState.errors.nombre.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>DNI / RUC <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="12345678" maxLength={11} {...form.register('dni_ruc')} />
              </div>
              <div className="space-y-1">
                <Label>Teléfono <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="987654321" {...form.register('telefono')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Email <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="email" placeholder="juan@email.com" {...form.register('email')} />
                {form.formState.errors.email && <p className="text-red-500 text-xs">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Puntos de fidelidad</Label>
                <Input type="number" min={0} {...form.register('puntos', { valueAsNumber: true })} />
                {form.formState.errors.puntos && <p className="text-red-500 text-xs">{form.formState.errors.puntos.message}</p>}
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

      {/* ── CONFIRM DELETE ── */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar cliente?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirmDel) return
              await deleteCliente(confirmDel)
              setConfirmDel(null)
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
