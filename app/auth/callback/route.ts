import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getPostAuthRedirectPath } from '@/lib/auth-redirect'
import type { Profile } from '@/lib/types'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requestedRedirect =
    searchParams.get('redirect_url') ?? searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let profile: Profile | null = null
      if (user?.id) {
        const admin = createAdminClient()
        const { data } = await admin
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        profile = (data as Profile | null) ?? null
      }

      const path = getPostAuthRedirectPath(profile, {
        redirectUrl: requestedRedirect,
      })
      const safePath = path.startsWith('/') ? path : `/${path}`
      return NextResponse.redirect(`${origin}${safePath}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`)
}
