import { createClient } from '@/lib/supabase/server'
import type { Pedido, PedidoItem, Producto } from '@/types/supabase'

export type PedidoConItems = Pedido & {
  mesa: { numero: number; salon: { nombre: string } | null } | null
  usuario: { nombre: string } | null
  items: (PedidoItem & { producto: Pick<Producto, 'nombre'> | null })[]
}

export async function getPedidosPendientes(tenantId: string): Promise<PedidoConItems[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      mesa:mesas(numero, salon:salones(nombre)),
      usuario:usuarios(nombre),
      items:pedido_items(*, producto:productos(nombre))
    `)
    .eq('tenant_id', tenantId)
    .in('estado', ['pendiente', 'preparando'])
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PedidoConItems[]
}

export async function crearPedido(payload: {
  tenant_id: string
  mesa_id: string | null
  usuario_id: string
  tipo: Pedido['tipo']
  canal?: Pedido['canal']
  total: number
  notas?: string
  items: { producto_id: string; cantidad: number; precio_unit: number; notas?: string }[]
}) {
  const supabase = await createClient()
  const { items, ...pedidoData } = payload

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({ ...pedidoData, descuento: 0 })
    .select('*')
    .single()
  if (pedidoError) throw pedidoError

  const { error: itemsError } = await supabase.from('pedido_items').insert(
    items.map((item) => ({
      pedido_id: (pedido as Pedido).id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unit: item.precio_unit,
      descuento: 0,
      notas: item.notas ?? null,
      estado: 'pendiente' as const,
    }))
  )
  if (itemsError) throw itemsError

  return pedido as Pedido
}

export async function actualizarEstadoPedido(pedidoId: string, estado: Pedido['estado']) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado })
    .eq('id', pedidoId)
  if (error) throw error
}
