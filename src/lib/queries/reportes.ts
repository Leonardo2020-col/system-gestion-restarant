import { createClient } from '@/lib/supabase/server'

export async function getVentasPorPeriodo(tenantId: string, desde: string, hasta: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, total, created_at, tipo, canal, estado')
    .eq('tenant_id', tenantId)
    .eq('estado', 'entregado')
    .gte('created_at', desde)
    .lte('created_at', hasta)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getProductosMasVendidos(tenantId: string, desde: string, hasta: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedido_items')
    .select(`
      cantidad,
      precio_unit,
      producto:productos!inner(nombre, tenant_id),
      pedido:pedidos!inner(created_at, estado, tenant_id)
    `)
    .eq('producto.tenant_id', tenantId)
    .eq('pedido.estado', 'entregado')
    .gte('pedido.created_at', desde)
    .lte('pedido.created_at', hasta)
  if (error) throw error
  return data
}
