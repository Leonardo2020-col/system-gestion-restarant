import { createClient } from '@/lib/supabase/server'
import { FacturasClient } from '@/components/facturas/facturas-client'
import type { Usuario, ConfiguracionFacturacion } from '@/types/supabase'

export default async function FacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const tenantId = usuario.tenant_id

  /* Configuración de facturación */
  const { data: cfgRaw } = await supabase
    .from('configuracion_facturacion').select('*').eq('tenant_id', tenantId).single()
  const config = cfgRaw as ConfiguracionFacturacion | null

  /* Pedidos entregados sin comprobante (últimos 90 días) */
  const desde90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: pedidosRaw } = await supabase
    .from('pedidos')
    .select('id, total, tipo, created_at, mesa:mesas(numero), cliente:clientes(nombre)')
    .eq('tenant_id', tenantId)
    .eq('estado', 'entregado')
    .gte('created_at', desde90)
    .order('created_at', { ascending: false })

  /* IDs que ya tienen comprobante */
  const { data: compExist } = await supabase
    .from('comprobantes')
    .select('pedido_id')

  const conComp = new Set((compExist ?? []).map((c: any) => c.pedido_id))

  const pedidosSin = ((pedidosRaw ?? []) as any[])
    .filter((p) => !conComp.has(p.id))
    .map((p) => ({
      id: p.id,
      mesa_numero: p.mesa?.numero ?? null,
      total: Number(p.total),
      tipo: p.tipo,
      created_at: p.created_at,
      cliente_nombre: p.cliente?.nombre ?? null,
    }))

  /* Comprobantes emitidos con info del pedido */
  const { data: compsRaw } = await supabase
    .from('comprobantes')
    .select('id, tipo, serie, correlativo, estado_sunat, emitido_at, pedido:pedidos(total, mesa:mesas(numero), cliente:clientes(nombre))')
    .order('emitido_at', { ascending: false })
    .limit(200)

  const comprobantes = ((compsRaw ?? []) as any[]).map((c) => ({
    id: c.id,
    tipo: c.tipo,
    serie: c.serie,
    correlativo: c.correlativo,
    estado_sunat: c.estado_sunat,
    emitido_at: c.emitido_at,
    pedido_total: Number(c.pedido?.total ?? 0),
    pedido_mesa: c.pedido?.mesa?.numero ?? null,
    pedido_cliente: c.pedido?.cliente?.nombre ?? null,
  }))

  const defaultConfig: ConfiguracionFacturacion = {
    id: '', tenant_id: tenantId,
    igv_porcentaje: 18, precios_con_igv: true, moneda: 'PEN',
    serie_boleta: 'B001', serie_factura: 'F001', serie_nota_venta: 'NV01',
    emite_boleta: true, emite_factura: false, emite_nota_venta: true,
    direccion: null, ubigeo: null, telefono_empresa: null, email_empresa: null,
    nota_pie: null, nubefact_token: null, nubefact_url_api: null, nubefact_modo: 'demo',
  }

  return (
    <FacturasClient
      tenantId={tenantId}
      pedidosSin={pedidosSin}
      comprobantes={comprobantes}
      config={config ?? defaultConfig}
    />
  )
}
