import { createClient } from '@/lib/supabase/server'
import { getMesasPorSalon, getSalones } from '@/lib/queries/mesas'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Usuario } from '@/types/supabase'

const estadoColors = {
  libre: 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300',
  ocupada: 'bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-300',
  reservada: 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300',
}

export default async function MesasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: raw } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = raw as Usuario | null
  if (!usuario) return null

  const [mesas, salones] = await Promise.all([
    getMesasPorSalon(usuario.tenant_id),
    getSalones(usuario.tenant_id),
  ])

  const libres = mesas.filter((m) => m.estado === 'libre').length
  const ocupadas = mesas.filter((m) => m.estado === 'ocupada').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-bold">Mesas</h1>
        <div className="flex gap-3">
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500">{libres} libres</Badge>
          <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500">{ocupadas} ocupadas</Badge>
        </div>
      </div>

      {salones.map((salon) => {
        const mesasSalon = mesas.filter((m) => m.salon_id === salon.id)
        return (
          <div key={salon.id}>
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">
              {salon.nombre}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
              {mesasSalon.map((mesa) => (
                <div
                  key={mesa.id}
                  className={cn(
                    'aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1',
                    estadoColors[mesa.estado]
                  )}
                >
                  <span className="font-bold text-xl">{mesa.numero}</span>
                  <span className="text-xs capitalize">{mesa.estado}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
