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
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Categoria, Producto } from '@/types/supabase'

/* ─── Schemas ─── */
const catSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  area_produccion: z.enum(['cocina', 'bar', 'horno']),
})
const prodSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  categoria_id: z.string().min(1, 'Selecciona una categoría'),
  descripcion: z.string().optional(),
  precio_salon: z.number().positive('Debe ser mayor a 0'),
  precio_llevar: z.number().positive('Debe ser mayor a 0').optional().or(z.literal(0)),
  activo: z.boolean(),
})
type CatForm = z.infer<typeof catSchema>
type ProdForm = z.infer<typeof prodSchema>

/* ─── Props ─── */
type Props = {
  categorias: Categoria[]
  productos: Producto[]
  tenantId: string
}

/* ─── Component ─── */
export function CartaClient({ categorias: initCats, productos: initProds, tenantId }: Props) {
  const supabase = createClient()
  const [categorias, setCategorias] = useState(initCats)
  const [productos, setProductos] = useState(initProds)

  /* dialogs */
  const [catDialog, setCatDialog] = useState<{ open: boolean; editando: Categoria | null }>({ open: false, editando: null })
  const [prodDialog, setProdDialog] = useState<{ open: boolean; editando: Producto | null }>({ open: false, editando: null })
  const [confirmDel, setConfirmDel] = useState<{ tipo: 'cat' | 'prod'; id: string } | null>(null)

  /* ── Categoría form ── */
  const catForm = useForm<CatForm>({
    resolver: zodResolver(catSchema),
    defaultValues: { nombre: '', area_produccion: 'cocina' },
  })

  function openCatDialog(cat?: Categoria) {
    catForm.reset(cat ? { nombre: cat.nombre, area_produccion: cat.area_produccion } : { nombre: '', area_produccion: 'cocina' })
    setCatDialog({ open: true, editando: cat ?? null })
  }

  async function submitCat(data: CatForm) {
    if (catDialog.editando) {
      const { data: updated, error } = await supabase
        .from('categorias').update(data).eq('id', catDialog.editando.id).select().single()
      if (error) { toast.error('Error al actualizar categoría'); return }
      setCategorias((p) => p.map((c) => c.id === catDialog.editando!.id ? updated as Categoria : c))
      toast.success('Categoría actualizada')
    } else {
      const { data: created, error } = await supabase
        .from('categorias').insert({ ...data, tenant_id: tenantId }).select().single()
      if (error) { toast.error('Error al crear categoría'); return }
      setCategorias((p) => [...p, created as Categoria])
      toast.success('Categoría creada')
    }
    setCatDialog({ open: false, editando: null })
  }

  async function deleteCat(id: string) {
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) { toast.error('No se puede eliminar (tiene productos asociados)'); return }
    setCategorias((p) => p.filter((c) => c.id !== id))
    setProductos((p) => p.filter((pr) => pr.categoria_id !== id))
    toast.success('Categoría eliminada')
  }

  /* ── Producto form ── */
  const prodForm = useForm<ProdForm>({
    resolver: zodResolver(prodSchema),
    defaultValues: { nombre: '', categoria_id: '', descripcion: '', precio_salon: 0, precio_llevar: 0, activo: true },
  })

  function openProdDialog(prod?: Producto) {
    prodForm.reset(prod ? {
      nombre: prod.nombre,
      categoria_id: prod.categoria_id,
      descripcion: prod.descripcion ?? '',
      precio_salon: prod.precio_salon,
      precio_llevar: prod.precio_llevar ?? 0,
      activo: prod.activo,
    } : { nombre: '', categoria_id: '', descripcion: '', precio_salon: 0, precio_llevar: 0, activo: true })
    setProdDialog({ open: true, editando: prod ?? null })
  }

  async function submitProd(data: ProdForm) {
    const payload = {
      nombre: data.nombre,
      categoria_id: data.categoria_id,
      descripcion: data.descripcion || null,
      precio_salon: data.precio_salon,
      precio_llevar: data.precio_llevar || null,
      activo: data.activo,
    }
    if (prodDialog.editando) {
      const { data: updated, error } = await supabase
        .from('productos').update(payload).eq('id', prodDialog.editando.id).select().single()
      if (error) { toast.error('Error al actualizar producto'); return }
      setProductos((p) => p.map((pr) => pr.id === prodDialog.editando!.id ? updated as Producto : pr))
      toast.success('Producto actualizado')
    } else {
      const { data: created, error } = await supabase
        .from('productos').insert({ ...payload, tenant_id: tenantId }).select().single()
      if (error) { toast.error('Error al crear producto'); return }
      setProductos((p) => [...p, created as Producto])
      toast.success('Producto creado')
    }
    setProdDialog({ open: false, editando: null })
  }

  async function toggleProducto(prod: Producto) {
    const { error } = await supabase.from('productos').update({ activo: !prod.activo }).eq('id', prod.id)
    if (error) { toast.error('Error'); return }
    setProductos((p) => p.map((pr) => pr.id === prod.id ? { ...pr, activo: !pr.activo } : pr))
  }

  async function deleteProd(id: string) {
    const { error } = await supabase.from('productos').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar producto'); return }
    setProductos((p) => p.filter((pr) => pr.id !== id))
    toast.success('Producto eliminado')
  }

  /* ─── UI ─── */
  return (
    <div className="space-y-6">
      <Tabs defaultValue="productos">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-foreground text-2xl font-bold">Carta</h1>
          <TabsList>
            <TabsTrigger value="productos">Productos ({productos.length})</TabsTrigger>
            <TabsTrigger value="categorias">Categorías ({categorias.length})</TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB PRODUCTOS ── */}
        <TabsContent value="productos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openProdDialog()}>+ Nuevo producto</Button>
          </div>
          <div className="space-y-2">
            {categorias.map((cat) => {
              const prods = productos.filter((p) => p.categoria_id === cat.id)
              return (
                <div key={cat.id}>
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">{cat.nombre}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {prods.map((p) => (
                      <Card key={p.id} className={p.activo ? '' : 'opacity-50'}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground font-medium text-sm truncate">{p.nombre}</p>
                              {p.descripcion && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{p.descripcion}</p>}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">S/ {Number(p.precio_salon).toFixed(2)}</span>
                                {p.precio_llevar && <span className="text-muted-foreground text-xs">Llevar: S/ {Number(p.precio_llevar).toFixed(2)}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openProdDialog(p)}>Editar</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => toggleProducto(p)}>
                                {p.activo ? 'Desactivar' : 'Activar'}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => setConfirmDel({ tipo: 'prod', id: p.id })}>Eliminar</Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {prods.length === 0 && <p className="text-muted-foreground text-sm col-span-full">Sin productos en esta categoría</p>}
                  </div>
                </div>
              )
            })}
            {categorias.length === 0 && <p className="text-muted-foreground text-center py-12">Crea categorías primero</p>}
          </div>
        </TabsContent>

        {/* ── TAB CATEGORÍAS ── */}
        <TabsContent value="categorias" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openCatDialog()}>+ Nueva categoría</Button>
          </div>
          <div className="space-y-2">
            {categorias.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div>
                  <p className="text-foreground font-medium">{cat.nombre}</p>
                  <Badge variant="outline" className="text-xs mt-1">{cat.area_produccion}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openCatDialog(cat)}>Editar</Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmDel({ tipo: 'cat', id: cat.id })}>Eliminar</Button>
                </div>
              </div>
            ))}
            {categorias.length === 0 && <p className="text-muted-foreground text-center py-12">Sin categorías</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── DIALOG CATEGORÍA ── */}
      <Dialog open={catDialog.open} onOpenChange={(v) => !v && setCatDialog({ open: false, editando: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catDialog.editando ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={catForm.handleSubmit(submitCat)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input placeholder="Ej: Entradas, Bebidas…" {...catForm.register('nombre')} />
              {catForm.formState.errors.nombre && <p className="text-red-500 text-xs">{catForm.formState.errors.nombre.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Área de producción</Label>
              <Select
                value={catForm.watch('area_produccion')}
                onValueChange={(v) => catForm.setValue('area_produccion', v as 'cocina' | 'bar' | 'horno')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cocina">🍳 Cocina</SelectItem>
                  <SelectItem value="bar">🍹 Bar</SelectItem>
                  <SelectItem value="horno">🍕 Horno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatDialog({ open: false, editando: null })}>Cancelar</Button>
              <Button type="submit" disabled={catForm.formState.isSubmitting}>
                {catForm.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG PRODUCTO ── */}
      <Dialog open={prodDialog.open} onOpenChange={(v) => !v && setProdDialog({ open: false, editando: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{prodDialog.editando ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={prodForm.handleSubmit(submitProd)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nombre</Label>
                <Input placeholder="Ej: Lomo saltado" {...prodForm.register('nombre')} />
                {prodForm.formState.errors.nombre && <p className="text-red-500 text-xs">{prodForm.formState.errors.nombre.message}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Categoría</Label>
                <Select
                  value={prodForm.watch('categoria_id')}
                  onValueChange={(v) => prodForm.setValue('categoria_id', v ?? '')}
                >
                  <SelectTrigger>
                    <span className="truncate text-sm">
                      {categorias.find((c) => c.id === prodForm.watch('categoria_id'))?.nombre ?? <span className="text-muted-foreground">Selecciona…</span>}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                {prodForm.formState.errors.categoria_id && <p className="text-red-500 text-xs">{prodForm.formState.errors.categoria_id.message}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descripción <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="Breve descripción…" {...prodForm.register('descripcion')} />
              </div>
              <div className="space-y-1">
                <Label>Precio salón (S/)</Label>
                <Input type="number" step="0.01" {...prodForm.register('precio_salon', { valueAsNumber: true })} />
                {prodForm.formState.errors.precio_salon && <p className="text-red-500 text-xs">{prodForm.formState.errors.precio_salon.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Precio llevar (S/) <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="number" step="0.01" {...prodForm.register('precio_llevar', { valueAsNumber: true })} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="activo" className="w-4 h-4" {...prodForm.register('activo')} />
                <Label htmlFor="activo" className="cursor-pointer">Producto activo (visible en carta y POS)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProdDialog({ open: false, editando: null })}>Cancelar</Button>
              <Button type="submit" disabled={prodForm.formState.isSubmitting}>
                {prodForm.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE ── */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar {confirmDel?.tipo === 'cat' ? 'categoría' : 'producto'}?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirmDel) return
              if (confirmDel.tipo === 'cat') await deleteCat(confirmDel.id)
              else await deleteProd(confirmDel.id)
              setConfirmDel(null)
            }}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
