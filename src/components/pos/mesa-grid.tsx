'use client'
import { cn } from '@/lib/utils'
import type { Salon } from '@/types/supabase'
import type { MesaConSalon } from '@/lib/queries/mesas'

type Props = {
  mesas: MesaConSalon[]
  salones: Salon[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const estadoColors = {
  libre: 'bg-emerald-900/40 border-emerald-700 hover:bg-emerald-800/50',
  ocupada: 'bg-orange-900/40 border-orange-700 hover:bg-orange-800/50',
  reservada: 'bg-blue-900/40 border-blue-700 hover:bg-blue-800/50',
}

const estadoLabel = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
}

export function MesaGrid({ mesas, salones, selectedId, onSelect }: Props) {
  return (
    <div className="space-y-6">
      {salones.map((salon) => {
        const mesasSalon = mesas.filter((m) => m.salon_id === salon.id)
        return (
          <div key={salon.id}>
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
              {salon.nombre}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {mesasSalon.map((mesa) => (
                <button
                  key={mesa.id}
                  onClick={() => onSelect(mesa.id)}
                  className={cn(
                    'relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all',
                    estadoColors[mesa.estado],
                    selectedId === mesa.id && 'ring-2 ring-white ring-offset-2 ring-offset-slate-950'
                  )}
                >
                  <span className="text-white font-bold text-xl">{mesa.numero}</span>
                  <span className="text-xs text-slate-300">{estadoLabel[mesa.estado]}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {mesas.length === 0 && (
        <div className="text-slate-500 text-center py-12">
          No hay mesas configuradas. Ve a Ajustes para agregar mesas.
        </div>
      )}
    </div>
  )
}
