import { createClient } from '@/lib/supabase/server'
import type { Mesa, Salon } from '@/types/supabase'

export type MesaConSalon = Mesa & { salon: { nombre: string } | null }

export async function getMesasPorSalon(tenantId: string): Promise<MesaConSalon[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mesas')
    .select(`*, salon:salones(nombre)`)
    .eq('tenant_id', tenantId)
    .order('numero')
  if (error) throw error
  return (data ?? []) as MesaConSalon[]
}

export async function getSalones(tenantId: string): Promise<Salon[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('salones')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('orden')
  if (error) throw error
  return (data ?? []) as Salon[]
}

export async function actualizarEstadoMesa(mesaId: string, estado: Mesa['estado']) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mesas')
    .update({ estado })
    .eq('id', mesaId)
  if (error) throw error
}
