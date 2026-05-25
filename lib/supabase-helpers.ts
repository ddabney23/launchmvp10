/**
 * Supabase Query Helpers
 * 
 * Helper functions to handle Supabase queries with strict TypeScript settings.
 * These wrappers work around type inference issues in the Supabase SDK when
 * using exactOptionalPropertyTypes and noUncheckedIndexedAccess.
 */

/**
 * Safely execute a Supabase .eq() query with proper type handling
 * 
 * @example
 * const { data, error } = await safeEq(
 *   supabase.from('profiles').select('*'),
 *   'id',
 *   userId
 * )
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
