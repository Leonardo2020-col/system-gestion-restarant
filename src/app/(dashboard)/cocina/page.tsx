import { createClient } from '@/lib/supabase/server'
import { getPedidosPendientes } from '@/lib/queries/pedidos'
import { KdsClient } from '@/components/kds/kds-client'
import type { Usuario } from '@/types/supabase'

export default async function CocinaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: raw } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = raw as Usuario | null
  if (!usuario) return <div className="text-red-400">Error de perfil</div>

  const pedidos = await getPedidosPendientes(usuario.tenant_id)
  return <KdsClient pedidosIniciales={pedidos} tenantId={usuario.tenant_id} />
}
