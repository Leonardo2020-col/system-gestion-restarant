'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { format, subDays, startOfDay, endOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

/* ─── Types ─── */
type DiaVenta = { fecha: string; pedidos: number; ventas: number }
type TopProducto = { nombre: string; total_vendido: number; ingresos: number }
type VentaTipo = { tipo: string; pedidos: number; total: number }
type Resumen = { ventasTotal: number; pedidosTotal: number; ticketPromedio: number; cancelados: number }

type Props = {
  tenantId: string
  inicialResumen: Resumen
  inicialDias: DiaVenta[]
  inicialTop: TopProducto[]
  inicialTipos: VentaTipo[]
}

type Rango = 'hoy' | 'semana' | 'mes' | 'personalizado'

/* ─── CSV helper ─── */
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = String(r[h] ?? '').replace(/"/g, '""')
        return v.includes(',') ? `"${v}"` : v
      }).join(',')
    ),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportesClient({ tenantId, inicialResumen, inicialDias, inicialTop, inicialTipos }: Props) {
  const supabase = createClient()
  const [rango, setRango] = useState<Rango>('mes')
  const [desde, setDesde] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [hasta, setHasta] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [resumen, setResumen] = useState(inicialResumen)
  const [dias, setDias] = useState(inicialDias)
  const [top, setTop] = useState(inicialTop)
  const [tipos, setTipos] = useState(inicialTipos)

  const fetchData = useCallback(async (desdeISO: string, hastaISO: string) => {
    setLoading(true)
    try {
      /* Pedidos en el rango */
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, total, tipo, estado, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', desdeISO)
        .lte('created_at', hastaISO)

      const entregados = (pedidos ?? []).filter((p) => p.estado === 'entregado')
      const cancelados = (pedidos ?? []).filter((p) => p.estado === 'anulado').length
      const ventasTotal = entregados.reduce((s, p) => s + Number(p.total), 0)
      const pedidosTotal = entregados.length
      setResumen({
        ventasTotal,
        pedidosTotal,
        ticketPromedio: pedidosTotal ? ventasTotal / pedidosTotal : 0,
        cancelados,
      })

      /* Ventas por día */
      const mapaFecha: Record<string, { pedidos: number; ventas: number }> = {}
      for (const p of entregados) {
        const d = p.created_at.slice(0, 10)
        if (!mapaFecha[d]) mapaFecha[d] = { pedidos: 0, ventas: 0 }
        mapaFecha[d].pedidos += 1
        mapaFecha[d].ventas += Number(p.total)
      }
      const diasArr: DiaVenta[] = Object.entries(mapaFecha)
        .map(([fecha, v]) => ({ fecha, ...v }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
      setDias(diasArr)

      /* Ventas por tipo */
      const mapaTipo: Record<string, { pedidos: number; total: number }> = {}
      for (const p of entregados) {
        if (!mapaTipo[p.tipo]) mapaTipo[p.tipo] = { pedidos: 0, total: 0 }
        mapaTipo[p.tipo].pedidos += 1
        mapaTipo[p.tipo].total += Number(p.total)
      }
      setTipos(Object.entries(mapaTipo).map(([tipo, v]) => ({ tipo, ...v })))

      /* Top productos */
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
        setTop(Object.values(mapaP).sort((a, b) => b.total_vendido - a.total_vendido).slice(0, 10))
      } else {
        setTop([])
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, tenantId])

  function aplicarRango(r: Rango) {
    setRango(r)
    const hoy = new Date()
    let d = '', h = format(endOfDay(hoy), "yyyy-MM-dd'T'HH:mm:ss")
    if (r === 'hoy') { d = format(startOfDay(hoy), "yyyy-MM-dd'T'HH:mm:ss") }
    else if (r === 'semana') { d = format(startOfWeek(hoy, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss") }
    else if (r === 'mes') { d = format(startOfMonth(hoy), "yyyy-MM-dd'T'HH:mm:ss") }
    else { d = desde + 'T00:00:00'; h = hasta + 'T23:59:59' }
    if (r !== 'personalizado') fetchData(d, h)
  }

  function aplicarPersonalizado() {
    fetchData(desde + 'T00:00:00', hasta + 'T23:59:59')
  }

  const maxVenta = dias.length ? Math.max(...dias.map((d) => d.ventas)) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-foreground text-2xl font-bold">Reportes</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadCSV(
            dias.map((d) => ({ Fecha: d.fecha, Pedidos: d.pedidos, 'Ventas (S/)': d.ventas.toFixed(2) })),
            `ventas-${rango}-${format(new Date(), 'yyyyMMdd')}.csv`
          )}
        >
          ⬇️ Exportar CSV
        </Button>
      </div>

      {/* Selector de rango */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['hoy', 'semana', 'mes', 'personalizado'] as Rango[]).map((r) => (
          <button
            key={r}
            onClick={() => aplicarRango(r)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              rango === r ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {r === 'hoy' ? 'Hoy' : r === 'semana' ? 'Esta semana' : r === 'mes' ? 'Este mes' : 'Personalizado'}
          </button>
        ))}
        {rango === 'personalizado' && (
          <div className="flex items-center gap-2">
            <Input type="date" className="h-8 w-36 text-xs" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span className="text-muted-foreground text-xs">—</span>
            <Input type="date" className="h-8 w-36 text-xs" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <Button size="sm" className="h-8" onClick={aplicarPersonalizado}>Aplicar</Button>
          </div>
        )}
        {loading && <span className="text-muted-foreground text-xs animate-pulse">Cargando…</span>}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ventas totales', value: `S/ ${resumen.ventasTotal.toFixed(2)}`, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pedidos entregados', value: String(resumen.pedidosTotal), color: 'text-foreground' },
          { label: 'Ticket promedio', value: `S/ ${resumen.ticketPromedio.toFixed(2)}`, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Pedidos cancelados', value: String(resumen.cancelados), color: 'text-red-500' },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-muted-foreground text-xs mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ventas por día */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground font-semibold">Ventas por día</h2>
            <Button size="sm" variant="ghost" className="text-xs h-7"
              onClick={() => downloadCSV(
                dias.map((d) => ({ Fecha: d.fecha, Pedidos: d.pedidos, 'Ventas (S/)': d.ventas.toFixed(2) })),
                `ventas-diarias-${format(new Date(), 'yyyyMMdd')}.csv`
              )}>
              ⬇️ CSV
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-left">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium text-center">Pedidos</th>
                  <th className="px-4 py-2 font-medium text-right">Ventas</th>
                  <th className="px-4 py-2 font-medium">Barra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dias.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sin ventas en el período</td></tr>
                ) : dias.map((d) => (
                  <tr key={d.fecha} className="bg-card">
                    <td className="px-4 py-2 text-foreground font-medium">
                      {format(new Date(d.fecha + 'T12:00:00'), 'EEE dd MMM', { locale: es })}
                    </td>
                    <td className="px-4 py-2 text-center text-muted-foreground">{d.pedidos}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      S/ {d.ventas.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 w-32">
                      <div className="bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${(d.ventas / maxVenta) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          {/* Top productos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground font-semibold">Top productos</h2>
              <Button size="sm" variant="ghost" className="text-xs h-7"
                onClick={() => downloadCSV(
                  top.map((p) => ({ Producto: p.nombre, Vendidos: p.total_vendido, 'Ingresos (S/)': p.ingresos.toFixed(2) })),
                  `top-productos-${format(new Date(), 'yyyyMMdd')}.csv`
                )}>⬇️ CSV</Button>
            </div>
            <div className="space-y-2">
              {top.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Sin datos</p>
              ) : top.map((p, i) => (
                <div key={p.nombre} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground text-xs font-mono w-4 shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm truncate font-medium">{p.nombre}</p>
                    <p className="text-muted-foreground text-xs">{p.total_vendido} unidades</p>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold shrink-0">
                    S/ {p.ingresos.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Por tipo */}
          <div className="space-y-3">
            <h2 className="text-foreground font-semibold">Por tipo de pedido</h2>
            <div className="space-y-2">
              {tipos.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Sin datos</p>
              ) : tipos.map((t) => (
                <div key={t.tipo} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-2">
                    <span>{t.tipo === 'salon' ? '🪑' : t.tipo === 'llevar' ? '🥡' : '🛵'}</span>
                    <span className="text-foreground text-sm capitalize">{t.tipo}</span>
                    <Badge variant="outline" className="text-xs">{t.pedidos}</Badge>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                    S/ {t.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
