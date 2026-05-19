import { createClient } from '@/lib/supabase/server'
import { getCajaActiva } from '@/lib/queries/caja'
import { CajaClient } from '@/components/caja/caja-client'
import type { Usuario } from '@/types/supabase'

export default async function CajaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: raw } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = raw as Usuario | null
  if (!usuario) return <div className="text-red-400">Error de perfil</div>

  const cajaActiva = await getCajaActiva(usuario.tenant_id)

  return (
    <CajaClient
      cajaActiva={cajaActiva as Parameters<typeof CajaClient>[0]['cajaActiva']}
      tenantId={usuario.tenant_id}
      usuarioId={user!.id}
    />
  )
}
