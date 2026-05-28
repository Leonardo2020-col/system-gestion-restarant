import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Usuario } from '@/types/supabase'

/* El cliente sólo envía lo que no podemos derivar del server */
const schema = z.object({
  mesa_id: z.string().nullable(),          // UUID real o null — validado como string
  tipo: z.enum(['salon', 'llevar', 'delivery']),
  total: z.coerce.number().positive(),
  notas: z.string().optional(),
  items: z.array(
    z.object({
      producto_id: z.string().min(1),
      cantidad: z.coerce.number().int().positive(),
      precio_unit: z.coerce.number().positive(),
      notas: z.string().optional(),
    })
  ).min(1),
})

export async function POST(req: Request) {
  const supabase = await createClient()

  /* 1. Auth — derivamos tenant_id y usuario_id del servidor, nunca del body */
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: rawUsuario } = await supabase
    .from('usuarios').select('id, tenant_id').eq('id', user.id).single()
  const usuario = rawUsuario as Pick<Usuario, 'id' | 'tenant_id'> | null
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

  /* 2. Validar body */
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, ...pedidoData } = parsed.data

  /* 3. Insertar pedido */
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({
      tenant_id: usuario.tenant_id,
      usuario_id: usuario.id,
      mesa_id: pedidoData.mesa_id,
      tipo: pedidoData.tipo,
      total: pedidoData.total,
      descuento: 0,
      canal: 'pos',
      notas: pedidoData.notas ?? null,
    })
    .select()
    .single()

  if (pedidoError) {
    return NextResponse.json({ error: pedidoError.message }, { status: 500 })
  }

  /* 4. Insertar ítems */
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

  /* 5. Marcar mesa como ocupada */
  if (pedidoData.mesa_id) {
    await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', pedidoData.mesa_id)
  }

  return NextResponse.json({ id: pedido.id }, { status: 201 })
}
