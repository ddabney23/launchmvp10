/**
 * Test authentication endpoint
 * GET /api/test-auth - Test if Supabase authentication is working
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getAuthUserId } from '@/lib/supabase-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getAuthUser>>
  let userId: string

  try {
    user = await getAuthUser()
    userId = await getAuthUserId()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
      },
      { status: 401 }
    )
  }

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
      },
      { status: 401 }
    )
  }

  try {
    const cookies = req.headers.get('cookie')

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      getAuthUserId: userId,
      hasCookies: !!cookies,
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
