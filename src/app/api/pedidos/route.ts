import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  tenant_id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  mesa_id: z.string().uuid().nullable(),
  tipo: z.enum(['salon', 'llevar', 'delivery']),
  total: z.number().positive(),
  notas: z.string().optional(),
  items: z.array(
    z.object({
      producto_id: z.string().uuid(),
      cantidad: z.number().int().positive(),
      precio_unit: z.number().positive(),
      notas: z.string().optional(),
    })
  ).min(1),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, ...pedidoData } = parsed.data

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({ ...pedidoData, descuento: 0, canal: 'pos' })
    .select()
    .single()

  if (pedidoError) {
    return NextResponse.json({ error: pedidoError.message }, { status: 500 })
  }

  const { error: itemsError } = await supabase.from('pedido_items').insert(
    items.map((item) => ({
      pedido_id: pedido.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unit: item.precio_unit,
      descuento: 0,
      notas: item.notas ?? null,
      estado: 'pendiente' as const,
    }))
  )

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Marcar mesa como ocupada
  if (pedidoData.mesa_id) {
    await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', pedidoData.mesa_id)
  }

  return NextResponse.json({ id: pedido.id }, { status: 201 })
}
