import { createClient } from '@/lib/supabase/server'
import { ClientesClient } from '@/components/clientes/clientes-client'
import type { Usuario, Cliente } from '@/types/supabase'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const { data: rawClientes } = await supabase
    .from('clientes')
    .select('*')
    .eq('tenant_id', usuario.tenant_id)
    .order('nombre')

  return (
    <ClientesClient
      clientes={(rawClientes ?? []) as Cliente[]}
      tenantId={usuario.tenant_id}
    />
  )
}
