const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'placeholder-anon-key'

export function hasSupabasePublicEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
}
