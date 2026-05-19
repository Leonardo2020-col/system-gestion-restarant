import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Usuario, Compra } from '@/types/supabase'

type CompraConProveedor = Compra & { proveedor: { nombre: string } | null }

export default async function ComprasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const { data: rawCompras } = await supabase
    .from('compras')
    .select('*, proveedor:proveedores(nombre)')
    .eq('tenant_id', usuario.tenant_id)
    .order('fecha', { ascending: false })
    .limit(50)
  const compras = (rawCompras ?? []) as unknown as CompraConProveedor[]

  return (
    <div className="space-y-6">
      <h1 className="text-white text-2xl font-bold">Compras</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="pb-3 font-medium">Fecha</th>
              <th className="pb-3 font-medium">Proveedor</th>
              <th className="pb-3 font-medium text-right">Total</th>
              <th className="pb-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {compras.map((c) => (
              <tr key={c.id}>
                <td className="py-3 text-slate-400 text-xs">
                  {format(new Date(c.fecha), 'dd MMM yyyy HH:mm', { locale: es })}
                </td>
                <td className="py-3 text-white">{c.proveedor?.nombre ?? '—'}</td>
                <td className="py-3 text-right text-emerald-400 font-medium">
                  S/ {Number(c.total).toFixed(2)}
                </td>
                <td className="py-3">
                  <Badge className="bg-slate-700 text-slate-300 capitalize">{c.estado}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {compras.length === 0 && (
          <div className="text-slate-500 text-center py-16">Sin compras registradas.</div>
        )}
      </div>
    </div>
  )
}
