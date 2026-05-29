'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ConfiguracionFacturacion } from '@/types/supabase'

/* ─── Types ─── */
type PedidoSinComprobante = {
  id: string; mesa_numero: number | null; total: number
  tipo: string; created_at: string; cliente_nombre: string | null
}
type Comprobante = {
  id: string; tipo: string; serie: string; correlativo: number
  estado_sunat: string; emitido_at: string | null
  pedido_total: number; pedido_mesa: number | null; pedido_cliente: string | null
}

type Props = {
  tenantId: string
  pedidosSin: PedidoSinComprobante[]
  comprobantes: Comprobante[]
  config: ConfiguracionFacturacion
}

const estadoSunatStyle: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-400',
  enviado:   'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400',
  aceptado:  'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400',
  rechazado: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-400',
}

const tipoLabel: Record<string, string> = {
  boleta: 'Boleta', factura: 'Factura', nota_venta: 'Nota de Venta',
}

export function FacturasClient({ tenantId, pedidosSin: initSin, comprobantes: initComp, config }: Props) {
  const supabase = createClient()
  const [pedidosSin, setPedidosSin] = useState(initSin)
  const [comprobantes, setComprobantes] = useState(initComp)
  const [emitirDialog, setEmitirDialog] = useState<PedidoSinComprobante | null>(null)
  const [tipoSelec, setTipoSelec] = useState<'boleta' | 'factura' | 'nota_venta'>('boleta')
  const [emitiendo, setEmitiendo] = useState(false)

  const tiposHabilitados = [
    config.emite_boleta    && 'boleta',
    config.emite_factura   && 'factura',
    config.emite_nota_venta && 'nota_venta',
  ].filter(Boolean) as ('boleta' | 'factura' | 'nota_venta')[]

  async function emitirComprobante() {
    if (!emitirDialog) return
    setEmitiendo(true)
    try {
      /* Correlativo: MAX actual + 1 para el tipo/serie */
      const serie = tipoSelec === 'boleta' ? config.serie_boleta
        : tipoSelec === 'factura' ? config.serie_factura
        : config.serie_nota_venta

      const { data: existentes } = await supabase
        .from('comprobantes')
        .select('correlativo')
        .eq('serie', serie)
        .eq('tipo', tipoSelec)
        .order('correlativo', { ascending: false })
        .limit(1)

      const correlativo = existentes && existentes.length > 0
        ? existentes[0].correlativo + 1 : 1

      const { data: comp, error } = await supabase
        .from('comprobantes')
        .insert({
          pedido_id: emitirDialog.id,
          tipo: tipoSelec,
          serie: serie ?? 'B001',
          correlativo,
          estado_sunat: 'pendiente',
          emitido_at: new Date().toISOString(),
        })
        .select().single()

      if (error) throw new Error(error.message)

      /* Agregar a lista y quitar de pendientes */
      const nuevo: Comprobante = {
        id: comp.id, tipo: comp.tipo, serie: comp.serie,
        correlativo: comp.correlativo, estado_sunat: comp.estado_sunat,
        emitido_at: comp.emitido_at,
        pedido_total: emitirDialog.total,
        pedido_mesa: emitirDialog.mesa_numero,
        pedido_cliente: emitirDialog.cliente_nombre,
      }
      setComprobantes((p) => [nuevo, ...p])
      setPedidosSin((p) => p.filter((x) => x.id !== emitirDialog.id))
      toast.success(`${tipoLabel[tipoSelec]} ${serie}-${String(correlativo).padStart(8, '0')} emitida ✓`)
      setEmitirDialog(null)
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setEmitiendo(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-bold">Facturas / Comprobantes</h1>
        <div className="flex items-center gap-2">
          {config.nubefact_token ? (
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500 text-xs">
              Nubefact {config.nubefact_modo}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Sin integración SUNAT
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="pendientes">
        <TabsList>
          <TabsTrigger value="pendientes">
            Por emitir {pedidosSin.length > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5">{pedidosSin.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="emitidos">Emitidos ({comprobantes.length})</TabsTrigger>
        </TabsList>

        {/* ── TAB: Por emitir ── */}
        <TabsContent value="pendientes" className="mt-4">
          {pedidosSin.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-3xl mb-3">✅</p>
              <p>Todos los pedidos tienen comprobante</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Mesa</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pedidosSin.map((p) => (
                    <tr key={p.id} className="bg-card hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(p.created_at), 'dd MMM HH:mm', { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {p.mesa_numero ? `Mesa ${p.mesa_numero}` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {p.cliente_nombre ?? <span className="text-muted-foreground text-xs">Sin cliente</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        S/ {Number(p.total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{p.tipo}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => { setEmitirDialog(p); setTipoSelec(tiposHabilitados[0] ?? 'boleta') }}
                          disabled={tiposHabilitados.length === 0}
                        >
                          Emitir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tiposHabilitados.length === 0 && (
            <p className="text-center text-amber-600 dark:text-amber-400 text-sm mt-4">
              ⚠️ Activa al menos un tipo de comprobante en <strong>Ajustes → Facturación</strong>
            </p>
          )}
        </TabsContent>

        {/* ── TAB: Emitidos ── */}
        <TabsContent value="emitidos" className="mt-4">
          {comprobantes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Sin comprobantes emitidos</div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium">Comprobante</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Mesa / Cliente</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Estado SUNAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comprobantes.map((c) => (
                    <tr key={c.id} className="bg-card hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium">{tipoLabel[c.tipo] ?? c.tipo}</span>
                        <span className="text-muted-foreground text-xs ml-2 font-mono">
                          {c.serie}-{String(c.correlativo).padStart(8, '0')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {c.emitido_at ? format(new Date(c.emitido_at), 'dd MMM yyyy HH:mm', { locale: es }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground text-sm">
                        {c.pedido_mesa ? `Mesa ${c.pedido_mesa}` : ''}
                        {c.pedido_cliente ? ` · ${c.pedido_cliente}` : ''}
                        {!c.pedido_mesa && !c.pedido_cliente && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        S/ {Number(c.pedido_total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border capitalize ${estadoSunatStyle[c.estado_sunat] ?? ''}`}>
                          {c.estado_sunat}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog emitir ── */}
      <Dialog open={!!emitirDialog} onOpenChange={(v) => !v && setEmitirDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Emitir comprobante</DialogTitle>
          </DialogHeader>
          {emitirDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="text-foreground font-mono text-xs">#{emitirDialog.id.slice(-8).toUpperCase()}</span>
                </div>
                {emitirDialog.mesa_numero && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mesa</span>
                    <span className="text-foreground">Mesa {emitirDialog.mesa_numero}</span>
                  </div>
                )}
                {emitirDialog.cliente_nombre && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="text-foreground">{emitirDialog.cliente_nombre}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-foreground font-semibold">Total</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    S/ {Number(emitirDialog.total).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Tipo de comprobante</label>
                <Select
                  value={tipoSelec}
                  onValueChange={(v) => setTipoSelec(v as typeof tipoSelec)}
                >
                  <SelectTrigger>
                    <span>{tipoLabel[tipoSelec] ?? tipoSelec}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {tiposHabilitados.map((t) => (
                      <SelectItem key={t} value={t}>{tipoLabel[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Serie: {tipoSelec === 'boleta' ? config.serie_boleta : tipoSelec === 'factura' ? config.serie_factura : config.serie_nota_venta}
                  {config.nubefact_modo === 'demo' && ' · Modo demo (no válido para SUNAT)'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmitirDialog(null)}>Cancelar</Button>
            <Button onClick={emitirComprobante} disabled={emitiendo}>
              {emitiendo ? 'Emitiendo…' : 'Emitir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
