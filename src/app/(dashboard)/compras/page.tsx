import { createClient } from '@/lib/supabase/server'
import { ComprasClient } from '@/components/compras/compras-client'
import type { Usuario, Proveedor, Insumo } from '@/types/supabase'

type CompraConDetalle = {
  id: string
  tenant_id: string
  proveedor_id: string
  total: number
  estado: string
  fecha: string
  proveedor: { nombre: string } | null
  items?: { id: string; insumo_id: string; cantidad: number; precio_unit: number }[]
}

export default async function ComprasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const tenantId = usuario.tenant_id

  const [{ data: rawCompras }, { data: rawProveedores }, { data: rawInsumos }] = await Promise.all([
    supabase
      .from('compras')
      .select('*, proveedor:proveedores(nombre)')
      .eq('tenant_id', tenantId)
      .order('fecha', { ascending: false })
      .limit(100),
    supabase
      .from('proveedores')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nombre'),
    supabase
      .from('insumos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <ComprasClient
      compras={(rawCompras ?? []) as unknown as CompraConDetalle[]}
      proveedores={(rawProveedores ?? []) as Proveedor[]}
      insumos={(rawInsumos ?? []) as Insumo[]}
      tenantId={tenantId}
    />
  )
}
