import { createClient } from '@/lib/supabase/server'
import { SucursalesClient } from '@/components/sucursales/sucursales-client'
import type { Usuario, Sucursal } from '@/types/supabase'

export default async function SucursalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const { data: rawSucursales } = await supabase
    .from('sucursales')
    .select('*')
    .eq('tenant_id', usuario.tenant_id)
    .order('es_principal', { ascending: false })
    .order('nombre')

  return (
    <SucursalesClient
      sucursales={(rawSucursales ?? []) as Sucursal[]}
      tenantId={usuario.tenant_id}
    />
  )
}
