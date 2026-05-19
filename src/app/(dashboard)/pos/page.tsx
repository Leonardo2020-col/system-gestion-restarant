import { createClient } from '@/lib/supabase/server'
import { getMesasPorSalon, getSalones } from '@/lib/queries/mesas'
import { getCategorias, getProductosActivos } from '@/lib/queries/productos'
import { PosClient } from '@/components/pos/pos-client'
import type { Usuario } from '@/types/supabase'

export default async function PosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: raw } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = raw as Usuario | null

  if (!usuario) return <div className="p-6 text-red-400">Error: perfil de usuario no encontrado</div>

  const tenantId = usuario.tenant_id

  const [mesas, salones, categorias, productos] = await Promise.all([
    getMesasPorSalon(tenantId),
    getSalones(tenantId),
    getCategorias(tenantId),
    getProductosActivos(tenantId),
  ])

  return (
    <PosClient
      mesas={mesas}
      salones={salones}
      categorias={categorias}
      productos={productos}
      tenantId={tenantId}
      usuarioId={user!.id}
    />
  )
}
