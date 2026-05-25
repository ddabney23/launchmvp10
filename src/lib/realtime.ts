/**
 * Unified Realtime Listener Utility
 * 
 * Provides centralized real-time subscription management for Supabase Realtime.
 * Handles subscriptions for posts, messages, bookings, and notifications.
 * 
 * Usage:
 * ```tsx
 * import { useRealtimeSubscription } from '@/lib/realtime'
 * 
 * useRealtimeSubscription('posts', {
 *   event: 'INSERT',
 *   filter: 'author=eq.user-id',
 *   callback: () => queryClient.invalidateQueries(['posts'])
 * })
 * ```
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'
import type { Database } from '@/integrations/supabase/types'
import { logger } from './logger'

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'
export type RealtimeTable = 'posts' | 'messages' | 'bookings' | 'notifications' | 'listings' | 'profiles' | 'comments'

export interface RealtimeSubscriptionOptions {
  /** Table to subscribe to */
  table: RealtimeTable
  /** Event type to listen for */
  event?: RealtimeEvent
  /** Filter expression (e.g., 'author=eq.user-id') */
  filter?: string
  /** Callback when event is received */
  callback: (payload: any) => void
  /** Channel name (auto-generated if not provided) */
  channelName?: string
  /** Whether subscription is enabled */
  enabled?: boolean
}

export interface RealtimeSubscription {
  channel: RealtimeChannel
  unsubscribe: () => void
}

/**
 * Create a realtime subscription
 * Returns a subscription object with unsubscribe method
 */
export function createRealtimeSubscription(
  supabase: SupabaseClient<Database>,
  options: RealtimeSubscriptionOptions
): RealtimeSubscription | null {
  if (options.enabled === false) {
    return null
  }

  const channelName = options.channelName || `realtime:${options.table}:${Date.now()}`
  
  // Use private channel for security (Supabase best practice)
  const channel = supabase
    .channel(channelName, {
      config: { private: true }, // Private channel for production security
    })
    .on(
      'postgres_changes',
      {
        event: options.event || '*',
        schema: 'public',
        table: options.table,
        filter: options.filter,
      },
      (payload) => {
        options.callback(payload)
      }
    )
    .subscribe((status, err) => {
      // Handle actual errors
      if (err) {
        logger.warn(`Realtime subscription error (non-critical) for ${options.table}`, { 
          status, 
          error: err.message || err,
          channelName, 
          filter: options.filter 
        });
        return;
      }
      
      // Log subscription status for debugging
      if (status === 'SUBSCRIBED') {
        logger.debug(`Realtime subscribed to ${options.table}`, { channelName, filter: options.filter })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // These are connection status changes, not errors - log as debug
        logger.debug(`Realtime subscription status changed for ${options.table}`, { status, channelName, filter: options.filter })
      }
    })

  return {
    channel,
    unsubscribe: () => {
      try {
        supabase.removeChannel(channel)
      } catch (error) {
        logger.error('Error removing realtime channel', error)
      }
    },
  }
}

/**
 * React hook for realtime subscriptions
 * Automatically cleans up on unmount
 * Uses ref for callback to avoid stale closures
 */
export function useRealtimeSubscription(
  supabase: SupabaseClient<Database>,
  options: RealtimeSubscriptionOptions
) {
  const subscriptionRef = useRef<RealtimeSubscription | null>(null)
  const callbackRef = useRef(options.callback)

  // Update ref when callback changes to avoid stale closures
  useEffect(() => {
    callbackRef.current = options.callback
  }, [options.callback])

  useEffect(() => {
    if (options.enabled === false) {
      return
    }

    // Use ref for callback to ensure we always use the latest version
    const subscription = createRealtimeSubscription(supabase, {
      ...options,
      callback: (payload) => callbackRef.current(payload)
    })
    subscriptionRef.current = subscription

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [
    supabase,
    options.table,
    options.event,
    options.filter,
    options.enabled,
    // callback is handled via ref above to avoid re-subscribing on every change
  ])
}

/**
 * Subscribe to posts in real-time
 */
export function subscribeToPosts(
  supabase: SupabaseClient<Database>,
  options: {
    filter?: string
    callback: (payload: any) => void
    enabled?: boolean
  }
) {
  return createRealtimeSubscription(supabase, {
    table: 'posts',
    event: 'INSERT',
    filter: options.filter,
    callback: options.callback,
    channelName: 'posts:subscription',
    enabled: options.enabled,
  })
}

/**
 * Subscribe to messages in real-time
 */
export function subscribeToMessages(
  supabase: SupabaseClient<Database>,
  options: {
    channelId: string
    callback: (payload: any) => void
    enabled?: boolean
  }
) {
  return createRealtimeSubscription(supabase, {
    table: 'messages',
    event: 'INSERT',
    filter: `channel_id=eq.${options.channelId}`,
    callback: options.callback,
    channelName: `messages:${options.channelId}`,
    enabled: options.enabled,
  })
}

/**
 * Subscribe to bookings in real-time
 */
export function subscribeToBookings(
  supabase: SupabaseClient<Database>,
  options: {
    userId: string
    role?: 'buyer' | 'vendor'
    callback: (payload: any) => void
    enabled?: boolean
  }
) {
  const filter = options.role === 'vendor' 
    ? `vendor=eq.${options.userId}`
    : `buyer=eq.${options.userId}`

  return createRealtimeSubscription(supabase, {
    table: 'bookings',
    event: '*',
    filter,
    callback: options.callback,
    channelName: `bookings:${options.userId}:${options.role || 'all'}`,
    enabled: options.enabled,
  })
}

/**
 * Subscribe to notifications in real-time
 */
export function subscribeToNotifications(
  supabase: SupabaseClient<Database>,
  options: {
    userId: string
    callback: (payload: any) => void
    enabled?: boolean
  }
) {
  return createRealtimeSubscription(supabase, {
    table: 'notifications',
    event: 'INSERT',
    filter: `user_id=eq.${options.userId}`,
    callback: options.callback,
    channelName: `notifications:${options.userId}`,
    enabled: options.enabled,
  })
}

/**
 * Subscribe to listings in real-time
 */
export function subscribeToListings(
  supabase: SupabaseClient<Database>,
  options: {
    filter?: string
    callback: (payload: any) => void
    enabled?: boolean
  }
) {
  return createRealtimeSubscription(supabase, {
    table: 'listings',
    event: '*',
    filter: options.filter,
    callback: options.callback,
    channelName: 'listings:subscription',
    enabled: options.enabled,
  })
}

