import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

type RealtimeSubscriptionStatus = 'subscribing' | 'subscribed' | 'error'

interface UseRealtimeOptions {
  event?: RealtimeEvent
  schema?: string
  filter?: string
}

/**
 * Subscribe to Supabase Realtime postgres_changes on a table.
 * Subscribes to INSERT/UPDATE/DELETE by default.
 * Auto-unsubscribes on unmount.
 * Returns subscription status.
 *
 * @param table - Table name
 * @param callback - Called on INSERT/UPDATE/DELETE
 * @param filter - Optional filter (e.g. "group_id=eq.xxx")
 */
function useRealtimeSubscription<T extends Record<string, unknown>>(
  table: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  filter?: string,
): RealtimeSubscriptionStatus {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const [status, setStatus] = useState<RealtimeSubscriptionStatus>('subscribing')

  useEffect(() => {
    setStatus('subscribing')
    const channelName = `realtime:${table}:${filter ?? 'all'}:${Date.now()}`
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          callbackRef.current(payload as RealtimePostgresChangesPayload<T>)
        },
      )
      .subscribe((status) => {
        setStatus(status === 'SUBSCRIBED' ? 'subscribed' : 'error')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter])

  return status
}

/**
 * @deprecated Use useRealtimeSubscription instead.
 * Subscribe to Supabase Realtime postgres_changes on a table.
 * Auto-unsubscribes on unmount.
 */
export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  options: UseRealtimeOptions = {},
) {
  const { filter } = options
  useRealtimeSubscription(table, callback, filter)
}
