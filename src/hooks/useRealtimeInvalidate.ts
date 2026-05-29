'use client'

import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { logger } from '@/lib/logger'

type RealtimeTable =
  | 'listings'
  | 'orders'
  | 'bookings'
  | 'news'
  | 'leaderboard'
  | 'user_badges'

/**
 * Subscribe to postgres_changes and invalidate React Query keys on updates.
 */
export function useRealtimeInvalidate(
  channelName: string,
  table: RealtimeTable,
  queryKeys: string[][],
  options?: { filter?: string; enabled?: boolean }
) {
  const queryClient = useQueryClient()
  const enabled = options?.enabled ?? true
  const keysSignature = useMemo(() => JSON.stringify(queryKeys), [queryKeys])

  useEffect(() => {
    if (!enabled) return

    const parsedKeys: string[][] = JSON.parse(keysSignature)

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(options?.filter ? { filter: options.filter } : {}),
        },
        () => {
          parsedKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey })
          })
        }
      )
      .subscribe((status, err) => {
        if (err) {
          logger.warn('Realtime subscription error (non-critical)', {
            channel: channelName,
            table,
            error: err.message || String(err),
          })
        } else if (status === 'SUBSCRIBED') {
          logger.debug('Realtime subscribed', { channel: channelName, table })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName, table, enabled, queryClient, options?.filter, keysSignature])
}
