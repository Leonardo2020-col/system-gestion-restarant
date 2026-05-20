import { createClient } from '@/lib/supabase/server'
import { InventarioClient } from '@/components/inventario/inventario-client'
import type { Usuario, Insumo } from '@/types/supabase'

export default async function InventarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const { data: rawInsumos } = await supabase
    .from('insumos')
    .select('*')
    .eq('tenant_id', usuario.tenant_id)
    .order('nombre')

  return (
    <InventarioClient
      insumos={(rawInsumos ?? []) as Insumo[]}
      tenantId={usuario.tenant_id}
    />
  )
}
