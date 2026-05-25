/**
 * Test authentication endpoint
 * GET /api/test-auth - Test if Supabase authentication is working
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getAuthUserId } from '@/lib/supabase-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    let userId: string | null = null
    try {
      userId = await getAuthUserId()
    } catch {
      userId = null
    }

    const cookies = req.headers.get('cookie')

    return NextResponse.json({
      success: true,
      user: user
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
      getAuthUserId: userId,
      hasCookies: !!cookies,
      cookieCount: cookies ? cookies.split(';').length : 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
