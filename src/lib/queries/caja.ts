import { createClient } from '@/lib/supabase/server'

export async function getCajaActiva(tenantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cajas')
    .select(`*, usuario:usuarios(nombre), movimientos:movimientos_caja(*)`)
    .eq('tenant_id', tenantId)
    .is('cerrada_at', null)
    .order('abierta_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function abrirCaja(tenantId: string, usuarioId: string, montoApertura: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cajas')
    .insert({ tenant_id: tenantId, usuario_id: usuarioId, monto_apertura: montoApertura })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cerrarCaja(cajaId: string, montoCierre: number) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('cajas')
    .update({ monto_cierre: montoCierre, cerrada_at: new Date().toISOString() })
    .eq('id', cajaId)
  if (error) throw error
}

export async function registrarMovimientoCaja(
  cajaId: string,
  tipo: 'ingreso' | 'egreso',
  monto: number,
  concepto: string
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('movimientos_caja')
    .insert({ caja_id: cajaId, tipo, monto, concepto })
  if (error) throw error
}
