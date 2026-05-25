/**
 * Type-safe Supabase helper functions
 * 
 * These helpers provide type-safe database operations with proper error handling
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/integrations/supabase/types'
import { logger } from './logger'

type SupabaseClientType = SupabaseClient<Database>

// ============================================================================
// STRICT MODE COMPATIBILITY HELPERS
// ============================================================================

/**
 * Safely execute a Supabase .eq() query with proper type handling
 * Works around type inference issues with strict TypeScript settings
 * 
 * @example
 * const { data, error } = await safeEq(
 *   supabase.from('profiles').select('*'),
 *   'id',
 *   userId
 * ).maybeSingle()
 */
export function safeEq<T>(
  query: T,
  column: string,
  value: string | number | boolean
): T {
  // @ts-expect-error - Supabase SDK has complex type inference that conflicts with strict settings
  return query.eq(column, value)
}

/**
 * Safely execute a Supabase .insert() query with proper type handling
 * Works around type inference issues with strict TypeScript settings
 * 
 * @example
 * const { data, error } = await safeInsert(
 *   supabase.from('profiles'),
 *   { id: '123', username: 'user' }
 * )
 */
export function safeInsert<T>(
  query: T,
  values: Record<string, unknown> | Record<string, unknown>[]
): T {
  // @ts-expect-error - Supabase SDK has complex type inference that conflicts with strict settings
  return query.insert(values)
}

/**
 * Safely execute a Supabase .update() query with proper type handling
 * Works around type inference issues with strict TypeScript settings
 * 
 * @example
 * const { data, error } = await safeUpdate(
 *   supabase.from('profiles'),
 *   { username: 'newname' }
 * ).eq('id', userId)
 */
export function safeUpdate<T>(
  query: T,
  values: Record<string, unknown>
): T {
  // @ts-expect-error - Supabase SDK has complex type inference that conflicts with strict settings
  return query.update(values)
}

/**
 * Safely check if a Supabase query result has a specific property
 * Handles SelectQueryError types properly
 * 
 * @example
 * if (hasProperty(profile, 'is_admin') && profile.is_admin) {
 *   // Safe to access profile.is_admin
 * }
 */
export function hasProperty<T, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj
}

/**
 * Type guard to check if value is NOT a Supabase error type
 */
export function isNotQueryError<T>(
  value: T
): value is Exclude<T, { message: string; details: string }> {
  if (typeof value !== 'object' || value === null) return false
  // Check if it has the error signature
  const hasErrorSig = 'message' in value && 'details' in value
  return !hasErrorSig
}

// ============================================================================
// QUERY RESULT TYPES
// ============================================================================

export interface QueryResult<T> {
  data: T | null
  error: Error | null
}

export interface QueryArrayResult<T> {
  data: T[] | null
  error: Error | null
}

// ============================================================================
// SINGLE RECORD HELPERS
// ============================================================================

/**
 * Get a single record by ID
 */
export async function getById<T extends { id: string }>(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  id: string
): Promise<QueryResult<T>> {
  try {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      logger.error(`Error fetching ${table} by id`, error, { id })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as T) || null, error: null }
  } catch (error) {
    logger.error(`Unexpected error fetching ${table} by id`, error, { id })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Get a single record with a custom filter
 */
export async function getOne<T>(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  filter: Record<string, unknown>
): Promise<QueryResult<T>> {
  try {
    let query = client.from(table).select('*')

    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value as string | number | boolean)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      logger.error(`Error fetching ${table}`, error, { filter })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as T) || null, error: null }
  } catch (error) {
    logger.error(`Unexpected error fetching ${table}`, error, { filter })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

// ============================================================================
// MULTIPLE RECORDS HELPERS
// ============================================================================

/**
 * Get multiple records with optional filters
 */
export async function getMany<T>(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  options?: {
    filter?: Record<string, unknown>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
    offset?: number
  }
): Promise<QueryArrayResult<T>> {
  try {
    let query = client.from(table).select('*')

    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        query = query.eq(key, value as string | number | boolean)
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? false,
      })
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      logger.error(`Error fetching ${table}`, error, { options })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as T[]) ?? [], error: null }
  } catch (error) {
    logger.error(`Unexpected error fetching ${table}`, error, { options })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

// ============================================================================
// CREATE HELPERS
// ============================================================================

/**
 * Create a single record
 */
export async function createOne<T extends Record<string, unknown>>(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  data: T
): Promise<QueryResult<T & { id: string }>> {
  try {
    const { data: created, error } = await client
      .from(table)
      .insert(data as never)
      .select()
      .single()

    if (error) {
      logger.error(`Error creating ${table}`, error, { data })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (created as T & { id: string }) || null, error: null }
  } catch (error) {
    logger.error(`Unexpected error creating ${table}`, error, { data })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Create multiple records
 */
export async function createMany<T extends Record<string, unknown>>(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  data: T[]
): Promise<QueryArrayResult<T & { id: string }>> {
  try {
    const { data: created, error } = await client
      .from(table)
      .insert(data as never[])
      .select()

    if (error) {
      logger.error(`Error creating ${table}`, error, { count: data.length })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (created as (T & { id: string })[]) ?? [], error: null }
  } catch (error) {
    logger.error(`Unexpected error creating ${table}`, error, { count: data.length })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

// ============================================================================
// UPDATE HELPERS
// ============================================================================

/**
 * Update a single record by ID
 */
export async function updateById<T extends Record<string, unknown>>(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  id: string,
  updates: Partial<T>
): Promise<QueryResult<T & { id: string }>> {
  try {
    const { data: updated, error } = await client
      .from(table)
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error(`Error updating ${table}`, error, { id, updates })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (updated as T & { id: string }) || null, error: null }
  } catch (error) {
    logger.error(`Unexpected error updating ${table}`, error, { id, updates })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Update multiple records with a filter
 */
export async function updateMany<T extends Record<string, unknown>>(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  filter: Record<string, unknown>,
  updates: Partial<T>
): Promise<QueryArrayResult<T & { id: string }>> {
  try {
    let query = client.from(table).update(updates as never)

    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value as string | number | boolean)
    }

    const { data: updated, error } = await query.select()

    if (error) {
      logger.error(`Error updating ${table}`, error, { filter, updates })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (updated as (T & { id: string })[]) ?? [], error: null }
  } catch (error) {
    logger.error(`Unexpected error updating ${table}`, error, { filter, updates })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

// ============================================================================
// DELETE HELPERS
// ============================================================================

/**
 * Delete a single record by ID
 */
export async function deleteById(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  id: string
): Promise<QueryResult<{ id: string }>> {
  try {
    const { data, error } = await client
      .from(table)
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error(`Error deleting ${table}`, error, { id })
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as { id: string }) || null, error: null }
  } catch (error) {
    logger.error(`Unexpected error deleting ${table}`, error, { id })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Delete multiple records with a filter
 */
export async function deleteMany(
  client: SupabaseClientType,
  table: keyof Database['public']['Tables'],
  filter: Record<string, unknown>
): Promise<QueryResult<{ count: number }>> {
  try {
    let query = client.from(table).delete()

    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value as string | number | boolean)
    }

    const { data, error } = await query.select()

    if (error) {
      logger.error(`Error deleting ${table}`, error, { filter })
      return { data: null, error: new Error(error.message) }
    }

    return {
      data: { count: Array.isArray(data) ? data.length : 0 },
      error: null,
    }
  } catch (error) {
    logger.error(`Unexpected error deleting ${table}`, error, { filter })
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

