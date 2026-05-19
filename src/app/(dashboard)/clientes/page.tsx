import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Usuario, Cliente } from '@/types/supabase'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawUsuario } = await supabase.from('usuarios').select('*').eq('id', user!.id).single()
  const usuario = rawUsuario as Usuario | null
  if (!usuario) return null

  const { data: rawClientes } = await supabase
    .from('clientes')
    .select('*')
    .eq('tenant_id', usuario.tenant_id)
    .order('nombre')
  const clientes = (rawClientes ?? []) as Cliente[]

  return (
    <div className="space-y-6">
      <h1 className="text-white text-2xl font-bold">Clientes</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="pb-3 font-medium">Nombre</th>
              <th className="pb-3 font-medium">DNI/RUC</th>
              <th className="pb-3 font-medium">Teléfono</th>
              <th className="pb-3 font-medium text-right">Puntos</th>
              <th className="pb-3 font-medium">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {clientes.map((c) => (
              <tr key={c.id}>
                <td className="py-3 text-white">{c.nombre}</td>
                <td className="py-3 text-slate-400">{c.dni_ruc ?? '—'}</td>
                <td className="py-3 text-slate-400">{c.telefono ?? '—'}</td>
                <td className="py-3 text-right text-amber-400 font-medium">{c.puntos}</td>
                <td className="py-3 text-slate-500 text-xs">
                  {format(new Date(c.created_at), 'dd MMM yyyy', { locale: es })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientes.length === 0 && (
          <div className="text-slate-500 text-center py-16">Sin clientes registrados.</div>
        )}
      </div>
    </div>
  )
}
