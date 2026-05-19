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
      <h1 className="text-foreground text-2xl font-bold">Inventario</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="pb-3 font-medium">Insumo</th>
              <th className="pb-3 font-medium">Unidad</th>
              <th className="pb-3 font-medium text-right">Stock actual</th>
              <th className="pb-3 font-medium text-right">Stock mínimo</th>
              <th className="pb-3 font-medium text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {insumos.map((insumo) => {
              const bajo = Number(insumo.stock_actual) <= Number(insumo.stock_minimo)
              return (
                <tr key={insumo.id}>
                  <td className="py-3 text-foreground">{insumo.nombre}</td>
                  <td className="py-3 text-muted-foreground">{insumo.unidad}</td>
                  <td className="py-3 text-right text-foreground">{insumo.stock_actual}</td>
                  <td className="py-3 text-right text-muted-foreground">{insumo.stock_minimo}</td>
                  <td className="py-3 text-right">
                    <Badge className={bajo
                      ? 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500'
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500'
                    }>
                      {bajo ? 'Stock bajo' : 'OK'}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {insumos.length === 0 && (
          <div className="text-muted-foreground text-center py-16">Sin insumos registrados.</div>
        )}
      </div>
    </div>
  )
}
