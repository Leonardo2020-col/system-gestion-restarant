'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function useKdsRealtime(tenantId: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`kds:${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: ['pedidos', tenantId] })
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedido_items' },
        () => queryClient.invalidateQueries({ queryKey: ['pedidos', tenantId] })
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tenantId, queryClient, supabase])
}
