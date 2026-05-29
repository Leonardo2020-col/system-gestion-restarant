import { createClient } from '@/lib/supabase/server'
import { AjustesClient } from '@/components/ajustes/ajustes-client'
import type { Usuario, Tenant, ConfiguracionFacturacion } from '@/types/supabase'

export default async function AjustesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuarioRaw } = await supabase
    .from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = usuarioRaw as Usuario | null
  if (!usuario) return null

  const { data: tenantRaw } = await supabase
    .from('tenants').select('*').eq('id', usuario.tenant_id).single()
  const tenant = tenantRaw as Tenant | null
  if (!tenant) return null

  /* Configuración de facturación — insertar si no existe */
  let { data: factRaw } = await supabase
    .from('configuracion_facturacion')
    .select('*')
    .eq('tenant_id', usuario.tenant_id)
    .single()

  if (!factRaw) {
    const { data: created } = await supabase
      .from('configuracion_facturacion')
      .insert({ tenant_id: usuario.tenant_id })
      .select().single()
    factRaw = created
  }

  const facturacion = factRaw as ConfiguracionFacturacion | null
  if (!facturacion) return null

  return (
    <AjustesClient
      usuario={usuario}
      userEmail={user!.email ?? '—'}
      tenant={tenant}
      facturacion={facturacion}
    />
  )
}
