/**
 * Escape user input used in PostgREST filter strings (.or(), .filter()).
 * Removes characters that alter filter grammar: , . ( ) "
 */
export function escapePostgrestFilterValue(value: string): string {
  return value.replace(/[,.()"]/g, '')
}

export function escapeIlikePattern(value: string): string {
  return escapePostgrestFilterValue(value).replace(/[%_\\]/g, '')
}
