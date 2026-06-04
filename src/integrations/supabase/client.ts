import {
  createClient as createBrowserSupabaseClient,
  type BrowserSupabaseClient,
} from '@/lib/supabase/client'

let browserClient: BrowserSupabaseClient | null = null

function getBrowserClient() {
  browserClient ??= createBrowserSupabaseClient()
  return browserClient
}

export const supabase = new Proxy({} as BrowserSupabaseClient, {
  get(_target, property, receiver) {
    const client = getBrowserClient()
    const value = Reflect.get(client, property, receiver)

    return typeof value === 'function' ? value.bind(client) : value
  },
})

export { createBrowserSupabaseClient as createClient }
