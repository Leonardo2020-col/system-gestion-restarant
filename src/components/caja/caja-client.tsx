'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Caja, MovimientoCaja, Usuario } from '@/types/supabase'

type CajaConDetalle = Caja & {
  usuario?: Pick<Usuario, 'nombre'>
  movimientos?: MovimientoCaja[]
}

type Props = {
  cajaActiva: CajaConDetalle | null
  tenantId: string
  usuarioId: string
}

const aperturaSchema = z.object({
  monto: z.number().positive('Debe ser positivo'),
})
const movSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.number().positive('Debe ser positivo'),
  concepto: z.string().min(3, 'Describe el concepto'),
})

type AperturaForm = z.infer<typeof aperturaSchema>
type MovForm = z.infer<typeof movSchema>

export function CajaClient({ cajaActiva, tenantId, usuarioId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [caja, setCaja] = useState(cajaActiva)

  const aperturaForm = useForm<AperturaForm>({
    resolver: zodResolver(aperturaSchema),
    defaultValues: { monto: 0 },
  })
  const movForm = useForm<MovForm>({
    resolver: zodResolver(movSchema),
    defaultValues: { tipo: 'ingreso', monto: 0, concepto: '' },
  })

  async function abrir({ monto }: AperturaForm) {
    const { data, error } = await supabase
      .from('cajas')
      .insert({ tenant_id: tenantId, usuario_id: usuarioId, monto_apertura: monto })
      .select('*, usuario:usuarios(nombre), movimientos:movimientos_caja(*)')
      .single()
    if (error) { toast.error('Error al abrir caja'); return }
    toast.success('Caja abierta')
    setCaja(data as CajaConDetalle)
    router.refresh()
  }

  async function cerrar() {
    if (!caja) return
    const movimientos = caja.movimientos ?? []
    const ingresos = movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
    const egresos = movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
    const montoCierre = caja.monto_apertura + ingresos - egresos

    const { error } = await supabase
      .from('cajas')
      .update({ monto_cierre: montoCierre, cerrada_at: new Date().toISOString() })
      .eq('id', caja.id)
    if (error) { toast.error('Error al cerrar caja'); return }
    toast.success(`Caja cerrada. Efectivo: S/ ${montoCierre.toFixed(2)}`)
    setCaja(null)
    router.refresh()
  }

  async function registrarMovimiento({ tipo, monto, concepto }: MovForm) {
    if (!caja) return
    const { data, error } = await supabase
      .from('movimientos_caja')
      .insert({ caja_id: caja.id, tipo, monto, concepto })
      .select()
      .single()
    if (error) { toast.error('Error al registrar movimiento'); return }
    toast.success('Movimiento registrado')
    setCaja((prev) => prev ? { ...prev, movimientos: [...(prev.movimientos ?? []), data] } : prev)
    movForm.reset({ tipo: 'ingreso', monto: 0, concepto: '' })
  }

  if (!caja) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Abrir Caja</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={aperturaForm.handleSubmit(abrir)} className="space-y-4">
              <div className="space-y-1">
                <Label>Monto de apertura (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...aperturaForm.register('monto', { valueAsNumber: true })}
                />
                {aperturaForm.formState.errors.monto && (
                  <p className="text-red-500 text-xs">{aperturaForm.formState.errors.monto.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={aperturaForm.formState.isSubmitting}>
                {aperturaForm.formState.isSubmitting ? 'Abriendo...' : 'Abrir caja'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const movimientos = caja.movimientos ?? []
  const ingresos = movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos = movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  const saldoActual = caja.monto_apertura + ingresos - egresos

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Caja</h1>
          <p className="text-muted-foreground text-sm">
            Abierta {format(new Date(caja.abierta_at), "dd MMM HH:mm", { locale: es })} por{' '}
            {caja.usuario?.nombre ?? 'desconocido'}
          </p>
        </div>
        <Button variant="destructive" onClick={cerrar}>Cerrar caja</Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Apertura', value: caja.monto_apertura, color: 'text-foreground' },
          { label: 'Ingresos', value: ingresos, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Egresos', value: egresos, color: 'text-red-600 dark:text-red-400' },
          { label: 'Saldo actual', value: saldoActual, color: 'text-foreground font-bold' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <p className="text-muted-foreground text-xs">{item.label}</p>
              <p className={`text-xl ${item.color}`}>S/ {item.value.toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Registrar movimiento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar movimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={movForm.handleSubmit(registrarMovimiento)} className="space-y-3">
              <div className="flex gap-2">
                {(['ingreso', 'egreso'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => movForm.setValue('tipo', t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      movForm.watch('tipo') === t
                        ? t === 'ingreso'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'ingreso' ? '+ Ingreso' : '− Egreso'}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <Label>Monto (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...movForm.register('monto', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label>Concepto</Label>
                <Input
                  placeholder="Ej: Pago efectivo mesa 3"
                  {...movForm.register('concepto')}
                />
                {movForm.formState.errors.concepto && (
                  <p className="text-red-500 text-xs">{movForm.formState.errors.concepto.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={movForm.formState.isSubmitting}>
                Registrar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Historial de movimientos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Movimientos ({movimientos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {movimientos.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Sin movimientos</p>
              ) : (
                [...movimientos].reverse().map((mov) => (
                  <div key={mov.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div>
                      <p className="text-foreground text-sm">{mov.concepto}</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(mov.created_at), 'HH:mm', { locale: es })}
                      </p>
                    </div>
                    <Badge
                      className={`ml-3 ${mov.tipo === 'ingreso'
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500'
                        : 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500'
                      }`}
                    >
                      {mov.tipo === 'ingreso' ? '+' : '−'} S/ {mov.monto.toFixed(2)}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
