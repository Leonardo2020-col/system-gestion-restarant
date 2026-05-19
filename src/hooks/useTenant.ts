'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tenant, Usuario } from '@/types/supabase'

type TenantState = {
  tenant: Tenant | null
  usuario: Usuario | null
  loading: boolean
}

export function useTenant() {
  const [state, setState] = useState<TenantState>({ tenant: null, usuario: null, loading: true })

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState({ tenant: null, usuario: null, loading: false })
        return
      }

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!usuario) {
        setState({ tenant: null, usuario: null, loading: false })
        return
      }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', usuario.tenant_id)
        .single()

      setState({ tenant: tenant ?? null, usuario, loading: false })
    }

    load()
  }, [])

  return state
}
