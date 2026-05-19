import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import type { Usuario } from '@/types/supabase'

type PedidoResumen = { id: string; total: number }

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()

  const [resHoy, resMes] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, total')
      .eq('tenant_id', usuario.tenant_id)
      .eq('estado', 'entregado')
      .gte('created_at', inicioHoy),
    supabase
      .from('pedidos')
      .select('id, total')
      .eq('tenant_id', usuario.tenant_id)
      .eq('estado', 'entregado')
      .gte('created_at', inicioMes),
  ])

  const pedidosHoy = (resHoy.data ?? []) as PedidoResumen[]
  const pedidosMes = (resMes.data ?? []) as PedidoResumen[]

  const ventasHoy = pedidosHoy.reduce((s, p) => s + Number(p.total), 0)
  const ventasMes = pedidosMes.reduce((s, p) => s + Number(p.total), 0)
  const ticketPromedio = pedidosMes.length ? ventasMes / pedidosMes.length : 0

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-bold">Reportes</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ventas hoy', value: `S/ ${ventasHoy.toFixed(2)}`, sub: `${pedidosHoy.length} pedidos` },
          { label: 'Ventas del mes', value: `S/ ${ventasMes.toFixed(2)}`, sub: `${pedidosMes.length} pedidos` },
          { label: 'Ticket promedio', value: `S/ ${ticketPromedio.toFixed(2)}`, sub: 'Este mes' },
          { label: 'Pedidos entregados', value: String(pedidosMes.length), sub: 'Este mes' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-muted-foreground text-xs mb-1">{item.label}</p>
              <p className="text-foreground text-2xl font-bold">{item.value}</p>
              <p className="text-muted-foreground text-xs mt-1">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-muted-foreground text-center py-12 bg-muted/50 rounded-xl border border-border">
        <p className="text-3xl mb-3">📊</p>
        <p>Gráficos y exportación CSV disponibles en la Fase 2</p>
      </div>
    </div>
  )
}
