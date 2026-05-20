import { createClient } from '@/lib/supabase/server'
import { CartaClient } from '@/components/carta/carta-client'
import type { Usuario, Categoria, Producto } from '@/types/supabase'

export default async function CartaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: raw } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = raw as Usuario | null
  if (!usuario) return null

  const [{ data: rawCats }, { data: rawProds }] = await Promise.all([
    supabase.from('categorias').select('*').eq('tenant_id', usuario.tenant_id).order('orden'),
    supabase.from('productos').select('*').eq('tenant_id', usuario.tenant_id).order('nombre'),
  ])

  return (
    <CartaClient
      categorias={(rawCats ?? []) as Categoria[]}
      productos={(rawProds ?? []) as Producto[]}
      tenantId={usuario.tenant_id}
    />
  )
}
