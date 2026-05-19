import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import type { Usuario, Insumo } from '@/types/supabase'

export default async function InventarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const { data: rawInsumos } = await supabase
    .from('insumos')
    .select('*')
    .eq('tenant_id', usuario.tenant_id)
    .eq('activo', true)
    .order('nombre')
  const insumos = (rawInsumos ?? []) as Insumo[]

  return (
    <div className="space-y-6">
      <h1 className="text-white text-2xl font-bold">Inventario</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="pb-3 font-medium">Insumo</th>
              <th className="pb-3 font-medium">Unidad</th>
              <th className="pb-3 font-medium text-right">Stock actual</th>
              <th className="pb-3 font-medium text-right">Stock mínimo</th>
              <th className="pb-3 font-medium text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {insumos.map((insumo) => {
              const bajo = Number(insumo.stock_actual) <= Number(insumo.stock_minimo)
              return (
                <tr key={insumo.id}>
                  <td className="py-3 text-white">{insumo.nombre}</td>
                  <td className="py-3 text-slate-400">{insumo.unidad}</td>
                  <td className="py-3 text-right text-white">{insumo.stock_actual}</td>
                  <td className="py-3 text-right text-slate-400">{insumo.stock_minimo}</td>
                  <td className="py-3 text-right">
                    <Badge className={bajo ? 'bg-red-900/50 text-red-300' : 'bg-emerald-900/50 text-emerald-300'}>
                      {bajo ? 'Stock bajo' : 'OK'}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {insumos.length === 0 && (
          <div className="text-slate-500 text-center py-16">Sin insumos registrados.</div>
        )}
      </div>
    </div>
  )
}
