import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Usuario, Tenant } from '@/types/supabase'

export default async function AjustesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuarioRaw } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user!.id)
    .single()
  const usuario = usuarioRaw as Usuario | null
  if (!usuario) return null

  const { data: tenantRaw } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', usuario.tenant_id)
    .single()
  const tenant = tenantRaw as Tenant | null
  if (!tenant) return null

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-foreground text-2xl font-bold">Ajustes</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restaurante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Nombre', value: tenant.nombre },
            { label: 'RUC', value: tenant.ruc },
            { label: 'Slug (URL menú)', value: tenant.slug, mono: true },
            { label: 'Plan', value: tenant.plan },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-muted-foreground text-sm">{item.label}</span>
              <span className={`text-foreground text-sm ${item.mono ? 'font-mono' : ''}`}>
                {item.value}
              </span>
            </div>
          ))}
          <div className="pt-2">
            <p className="text-muted-foreground text-sm mb-2">URL de tu carta QR</p>
            <code className="bg-muted text-foreground text-xs px-3 py-1.5 rounded-lg font-mono">
              /menu/{tenant.slug}
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mi cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          {[
            { label: 'Nombre', value: usuario.nombre },
            { label: 'Email', value: user!.email ?? '—' },
            { label: 'Rol', value: usuario.rol },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-muted-foreground text-sm">{item.label}</span>
              <span className="text-foreground text-sm capitalize">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
