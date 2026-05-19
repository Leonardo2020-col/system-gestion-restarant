import { createClient } from '@/lib/supabase/server'
import { getMesasPorSalon, getSalones } from '@/lib/queries/mesas'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Usuario } from '@/types/supabase'

const estadoColors = {
  libre: 'bg-emerald-900/40 border-emerald-700 text-emerald-300',
  ocupada: 'bg-orange-900/40 border-orange-700 text-orange-300',
  reservada: 'bg-blue-900/40 border-blue-700 text-blue-300',
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
        <h1 className="text-white text-2xl font-bold">Mesas</h1>
        <div className="flex gap-3">
          <Badge className="bg-emerald-900/50 text-emerald-300">{libres} libres</Badge>
          <Badge className="bg-orange-900/50 text-orange-300">{ocupadas} ocupadas</Badge>
        </div>
      </div>

      {salones.map((salon) => {
        const mesasSalon = mesas.filter((m) => m.salon_id === salon.id)
        return (
          <div key={salon.id}>
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
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
                  <span className="text-white font-bold text-xl">{mesa.numero}</span>
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
