'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { Usuario, Tenant, ConfiguracionFacturacion } from '@/types/supabase'

type Props = {
  usuario: Usuario
  userEmail: string
  tenant: Tenant
  facturacion: ConfiguracionFacturacion
}

export function AjustesClient({ usuario, userEmail, tenant, facturacion: initFact }: Props) {
  const supabase = createClient()
  const [fact, setFact] = useState(initFact)
  const [saving, setSaving] = useState(false)
  const [showToken, setShowToken] = useState(false)

  function update<K extends keyof ConfiguracionFacturacion>(key: K, value: ConfiguracionFacturacion[K]) {
    setFact((prev) => ({ ...prev, [key]: value }))
  }

  async function guardarFacturacion() {
    setSaving(true)
    const { error } = await supabase
      .from('configuracion_facturacion')
      .update({
        igv_porcentaje: fact.igv_porcentaje,
        precios_con_igv: fact.precios_con_igv,
        moneda: fact.moneda,
        serie_boleta: fact.serie_boleta,
        serie_factura: fact.serie_factura,
        serie_nota_venta: fact.serie_nota_venta,
        emite_boleta: fact.emite_boleta,
        emite_factura: fact.emite_factura,
        emite_nota_venta: fact.emite_nota_venta,
        direccion: fact.direccion || null,
        ubigeo: fact.ubigeo || null,
        telefono_empresa: fact.telefono_empresa || null,
        email_empresa: fact.email_empresa || null,
        nota_pie: fact.nota_pie || null,
        nubefact_token: fact.nubefact_token || null,
        nubefact_url_api: fact.nubefact_url_api || null,
        nubefact_modo: fact.nubefact_modo || 'demo',
      })
      .eq('tenant_id', fact.tenant_id)

    if (error) {
      toast.error(`Error al guardar: ${error.message}`)
    } else {
      toast.success('Configuración de facturación guardada ✓')
    }
    setSaving(false)
  }

  const igvDecimal = Number(fact.igv_porcentaje) / 100
  const ejemploPrecio = 100
  const ejemploBase = fact.precios_con_igv
    ? (ejemploPrecio / (1 + igvDecimal)).toFixed(2)
    : ejemploPrecio.toFixed(2)
  const ejemploIgv = fact.precios_con_igv
    ? (ejemploPrecio - Number(ejemploBase)).toFixed(2)
    : (ejemploPrecio * igvDecimal).toFixed(2)
  const ejemploTotal = fact.precios_con_igv
    ? ejemploPrecio.toFixed(2)
    : (ejemploPrecio + Number(ejemploIgv)).toFixed(2)

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-foreground text-2xl font-bold">Ajustes</h1>

      <Tabs defaultValue="restaurante">
        <TabsList className="mb-6">
          <TabsTrigger value="restaurante">Restaurante</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="cuenta">Mi cuenta</TabsTrigger>
        </TabsList>

        {/* ── TAB RESTAURANTE ── */}
        <TabsContent value="restaurante" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del negocio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                { label: 'Nombre', value: tenant.nombre },
                { label: 'RUC', value: tenant.ruc },
                { label: 'Slug (URL menú)', value: tenant.slug, mono: true },
                { label: 'Plan', value: tenant.plan },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="text-muted-foreground text-sm">{item.label}</span>
                  <span className={`text-foreground text-sm ${item.mono ? 'font-mono' : 'capitalize'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Carta QR pública</CardTitle>
              <CardDescription>Comparte este enlace para que tus clientes vean tu menú</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <code className="block bg-muted text-foreground text-sm px-4 py-3 rounded-lg font-mono break-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/menu/{tenant.slug}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/menu/${tenant.slug}`
                  navigator.clipboard.writeText(url)
                  toast.success('URL copiada al portapapeles')
                }}
              >
                Copiar enlace
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB FACTURACIÓN ── */}
        <TabsContent value="facturacion" className="space-y-4">

          {/* IGV */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">IGV e Impuestos</CardTitle>
              <CardDescription>Configura cómo se aplica el IGV a tus precios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Porcentaje de IGV (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={Number(fact.igv_porcentaje)}
                    onChange={(e) => update('igv_porcentaje', Number(e.target.value) as any)}
                  />
                  <p className="text-muted-foreground text-xs">Perú: 18%</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Moneda</Label>
                  <Select
                    value={fact.moneda ?? 'PEN'}
                    onValueChange={(v) => update('moneda', v ?? 'PEN')}
                  >
                    <SelectTrigger>
                      <span>{fact.moneda === 'USD' ? '🇺🇸 USD — Dólar' : '🇵🇪 PEN — Sol'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PEN">🇵🇪 PEN — Sol peruano</SelectItem>
                      <SelectItem value="USD">🇺🇸 USD — Dólar americano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Toggle precios con IGV */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                <input
                  type="checkbox"
                  id="precios_con_igv"
                  className="mt-0.5 w-4 h-4 accent-primary"
                  checked={fact.precios_con_igv}
                  onChange={(e) => update('precios_con_igv', e.target.checked)}
                />
                <div>
                  <Label htmlFor="precios_con_igv" className="cursor-pointer font-medium">
                    Los precios de la carta YA incluyen IGV
                  </Label>
                  <p className="text-muted-foreground text-xs mt-1">
                    {fact.precios_con_igv
                      ? 'El precio del producto es el precio final. El IGV se desglosa internamente.'
                      : 'Al precio del producto se le suma el IGV al momento de facturar.'}
                  </p>
                </div>
              </div>

              {/* Ejemplo */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Ejemplo con precio S/ {ejemploPrecio}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base imponible</span>
                    <span className="text-foreground">S/ {ejemploBase}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IGV ({Number(fact.igv_porcentaje)}%)</span>
                    <span className="text-foreground">S/ {ejemploIgv}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <span className="text-foreground font-semibold">Total</span>
                    <span className="text-foreground font-bold">S/ {ejemploTotal}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comprobantes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comprobantes de pago</CardTitle>
              <CardDescription>Tipos y series de comprobantes habilitados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {[
                  { key: 'emite_boleta' as const, label: 'Boleta de venta', desc: 'Para consumidores finales (persona natural sin RUC)', serieKey: 'serie_boleta' as const },
                  { key: 'emite_factura' as const, label: 'Factura electrónica', desc: 'Para empresas con RUC que requieren crédito fiscal', serieKey: 'serie_factura' as const },
                  { key: 'emite_nota_venta' as const, label: 'Nota de venta', desc: 'Documento interno sin validez tributaria SUNAT', serieKey: 'serie_nota_venta' as const },
                ].map((item) => (
                  <div key={item.key} className="flex items-start gap-4 p-4 rounded-lg border border-border">
                    <input
                      type="checkbox"
                      id={item.key}
                      className="mt-1 w-4 h-4 accent-primary"
                      checked={fact[item.key]}
                      onChange={(e) => update(item.key, e.target.checked)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label htmlFor={item.key} className="cursor-pointer font-medium">{item.label}</Label>
                        {fact[item.key] && <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500 text-xs">Activo</Badge>}
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5">{item.desc}</p>
                    </div>
                    <div className="w-24 shrink-0">
                      <p className="text-muted-foreground text-xs mb-1">Serie</p>
                      <Input
                        className="h-8 text-xs font-mono uppercase"
                        value={fact[item.serieKey] ?? ''}
                        onChange={(e) => update(item.serieKey, e.target.value.toUpperCase())}
                        disabled={!fact[item.key]}
                        maxLength={4}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Datos empresa */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del establecimiento</CardTitle>
              <CardDescription>Información que aparece en los comprobantes emitidos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Dirección</Label>
                  <Input
                    placeholder="Av. Ejemplo 123, Lima"
                    value={fact.direccion ?? ''}
                    onChange={(e) => update('direccion', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ubigeo <span className="text-muted-foreground text-xs">(6 dígitos)</span></Label>
                  <Input
                    placeholder="150101"
                    maxLength={6}
                    value={fact.ubigeo ?? ''}
                    onChange={(e) => update('ubigeo', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input
                    placeholder="01 234 5678"
                    value={fact.telefono_empresa ?? ''}
                    onChange={(e) => update('telefono_empresa', e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Email de contacto</Label>
                  <Input
                    type="email"
                    placeholder="contacto@mibodega.com"
                    value={fact.email_empresa ?? ''}
                    onChange={(e) => update('email_empresa', e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Nota al pie del comprobante</Label>
                  <Input
                    placeholder="Ej: Gracias por su preferencia. No se aceptan devoluciones."
                    value={fact.nota_pie ?? ''}
                    onChange={(e) => update('nota_pie', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nubefact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Integración Nubefact <span className="text-muted-foreground font-normal text-sm">(SUNAT)</span></CardTitle>
              <CardDescription>
                Conecta con Nubefact para emitir comprobantes electrónicos válidos ante SUNAT.{' '}
                <a href="https://www.nubefact.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                  Crear cuenta gratuita →
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Modo</Label>
                <Select
                  value={fact.nubefact_modo ?? 'demo'}
                  onValueChange={(v) => update('nubefact_modo', v)}
                >
                  <SelectTrigger>
                    <span className="flex items-center gap-2">
                      {fact.nubefact_modo === 'produccion'
                        ? <><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Producción</>
                        : <><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Demo / Pruebas</>}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">🟡 Demo / Pruebas</SelectItem>
                    <SelectItem value="produccion">🟢 Producción</SelectItem>
                  </SelectContent>
                </Select>
                {fact.nubefact_modo === 'produccion' && (
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                    ⚠️ Los comprobantes emitidos en modo producción tienen validez legal ante SUNAT.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>URL API de Nubefact</Label>
                <Input
                  placeholder="https://api.nubefact.com/api/v1"
                  value={fact.nubefact_url_api ?? ''}
                  onChange={(e) => update('nubefact_url_api', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Token de Nubefact</Label>
                <div className="flex gap-2">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="Token de autenticación"
                    value={fact.nubefact_token ?? ''}
                    onChange={(e) => update('nubefact_token', e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setShowToken((v) => !v)}
                  >
                    {showToken ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Obtén tu token en el panel de Nubefact → Configuración → API
                </p>
              </div>

              {fact.nubefact_token && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-emerald-700 dark:text-emerald-300 text-xs">
                    Token configurado — en modo {fact.nubefact_modo}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botón guardar */}
          <div className="flex justify-end">
            <Button onClick={guardarFacturacion} disabled={saving} size="lg">
              {saving ? 'Guardando…' : 'Guardar configuración de facturación'}
            </Button>
          </div>
        </TabsContent>

        {/* ── TAB CUENTA ── */}
        <TabsContent value="cuenta" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mi cuenta</CardTitle>
            </CardHeader>
            <CardContent>
              {[
                { label: 'Nombre', value: usuario.nombre },
                { label: 'Email', value: userEmail },
                { label: 'Rol', value: usuario.rol },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="text-muted-foreground text-sm">{item.label}</span>
                  <span className="text-foreground text-sm capitalize">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
