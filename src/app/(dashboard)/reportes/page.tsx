import { createClient } from '@/lib/supabase/server'
import { ReportesClient } from '@/components/reportes/reportes-client'
import type { Usuario } from '@/types/supabase'
import { startOfMonth } from 'date-fns'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const tenantId = usuario.tenant_id
  const inicioMes = startOfMonth(new Date()).toISOString()
  const ahora = new Date().toISOString()

  /* Pedidos del mes */
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, total, tipo, estado, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', inicioMes)
    .lte('created_at', ahora)

  const entregados = (pedidos ?? []).filter((p) => p.estado === 'entregado')
  const cancelados = (pedidos ?? []).filter((p) => p.estado === 'anulado').length
  const ventasTotal = entregados.reduce((s, p) => s + Number(p.total), 0)

  /* Ventas por día */
  const mapaFecha: Record<string, { pedidos: number; ventas: number }> = {}
  for (const p of entregados) {
    const d = (p.created_at as string).slice(0, 10)
    if (!mapaFecha[d]) mapaFecha[d] = { pedidos: 0, ventas: 0 }
    mapaFecha[d].pedidos += 1
    mapaFecha[d].ventas += Number(p.total)
  }
  const dias = Object.entries(mapaFecha)
    .map(([fecha, v]) => ({ fecha, ...v }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  /* Por tipo */
  const mapaTipo: Record<string, { pedidos: number; total: number }> = {}
  for (const p of entregados) {
    if (!mapaTipo[p.tipo]) mapaTipo[p.tipo] = { pedidos: 0, total: 0 }
    mapaTipo[p.tipo].pedidos += 1
    mapaTipo[p.tipo].total += Number(p.total)
  }
  const tipos = Object.entries(mapaTipo).map(([tipo, v]) => ({ tipo, ...v }))

  /* Top productos */
  let top: { nombre: string; total_vendido: number; ingresos: number }[] = []
  const ids = entregados.map((p) => p.id)
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('pedido_items')
      .select('producto_id, cantidad, precio_unit, producto:productos(nombre)')
      .in('pedido_id', ids)
    const mapaP: Record<string, { nombre: string; total_vendido: number; ingresos: number }> = {}
    for (const it of items ?? []) {
      const n = (it as any).producto?.nombre ?? it.producto_id
      if (!mapaP[it.producto_id]) mapaP[it.producto_id] = { nombre: n, total_vendido: 0, ingresos: 0 }
      mapaP[it.producto_id].total_vendido += Number(it.cantidad)
      mapaP[it.producto_id].ingresos += Number(it.cantidad) * Number(it.precio_unit)
    }
    top = Object.values(mapaP).sort((a, b) => b.total_vendido - a.total_vendido).slice(0, 10)
  }

  return (
    <ReportesClient
      tenantId={tenantId}
      inicialResumen={{
        ventasTotal,
        pedidosTotal: entregados.length,
        ticketPromedio: entregados.length ? ventasTotal / entregados.length : 0,
        cancelados,
      }}
      inicialDias={dias}
      inicialTop={top}
      inicialTipos={tipos}
    />
  )
}
