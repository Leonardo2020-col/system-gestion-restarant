import { createClient } from '@/lib/supabase/server'
import type { Producto, Categoria } from '@/types/supabase'

export type ProductoConCategoria = Producto & {
  categoria: { nombre: string; area_produccion: string } | null
}

export async function getProductosActivos(tenantId: string): Promise<ProductoConCategoria[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .select(`*, categoria:categorias(nombre, area_produccion)`)
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return (data ?? []) as ProductoConCategoria[]
}

export async function getCategorias(tenantId: string): Promise<Categoria[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('orden')
  if (error) throw error
  return (data ?? []) as Categoria[]
}

export async function getMenuPublico(slug: string) {
  const supabase = await createClient()
  const { data: tenant, error: tError } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .single()
  if (tError || !tenant) return null

  const { data: categorias, error: cError } = await supabase
    .from('categorias')
    .select(`*, productos(*)`)
    .eq('tenant_id', tenant.id)
    .eq('activo', true)
    .order('orden')
  if (cError) return null

  return { tenant, categorias: categorias ?? [] }
}
