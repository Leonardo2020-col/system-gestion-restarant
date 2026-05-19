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
  libre: 'bg-emerald-500/20 border-emerald-500 hover:bg-emerald-500/30',
  ocupada: 'bg-orange-500/20 border-orange-500 hover:bg-orange-500/30',
  reservada: 'bg-blue-500/20 border-blue-500 hover:bg-blue-500/30',
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
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">
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
                    selectedId === mesa.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  )}
                >
                  <span className="text-foreground font-bold text-xl">{mesa.numero}</span>
                  <span className="text-xs text-muted-foreground">{estadoLabel[mesa.estado]}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {mesas.length === 0 && (
        <div className="text-muted-foreground text-center py-12">
          No hay mesas configuradas. Ve a Ajustes para agregar mesas.
        </div>
      )}
    </div>
  )
}
