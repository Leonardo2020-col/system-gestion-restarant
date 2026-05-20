import { createClient } from '@/lib/supabase/server'
import { MesasClient } from '@/components/mesas/mesas-client'
import type { Usuario, Mesa, Salon } from '@/types/supabase'

export default async function MesasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: raw } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = raw as Usuario | null
  if (!usuario) return null

  const [{ data: rawSalones }, { data: rawMesas }] = await Promise.all([
    supabase.from('salones').select('*').eq('tenant_id', usuario.tenant_id).order('orden'),
    supabase.from('mesas').select('*').eq('tenant_id', usuario.tenant_id).order('numero'),
  ])

  return (
    <MesasClient
      salones={(rawSalones ?? []) as Salon[]}
      mesas={(rawMesas ?? []) as Mesa[]}
      tenantId={usuario.tenant_id}
    />
  )
}
