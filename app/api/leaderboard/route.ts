import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUser } from '@/lib/supabase-auth'
import { getCache, setCache } from '@/lib/cache'
import { logger } from '@/lib/logger'

/**
 * GET /api/leaderboard
 * Get top users by points with optional time period filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    let userId: string | undefined
    try {
      const authUser = await getAuthUser()
      userId = authUser?.id
    } catch {
      userId = undefined
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'all-time'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const cacheKey = `leaderboard:${period}:${limit}`

    const cacheTimeoutMs = 3000
    const cached = await Promise.race([
      getCache(cacheKey),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), cacheTimeoutMs)),
    ])
    if (cached) {
      logger.debug('Returning cached leaderboard data')
      return NextResponse.json(cached)
    }

    let dateFilter: Date | null = null
    if (period === 'monthly') {
      dateFilter = new Date()
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    } else if (period === 'weekly') {
      dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - 7)
    }

    let query = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, points, level')
      .order('points', { ascending: false })
      .limit(limit)

    if (dateFilter) {
      query = query.gte('updated_at', dateFilter.toISOString())
    }

    const { data: profiles, error } = await query

    if (error) {
      logger.error('Failed to fetch leaderboard:', error)
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      )
    }

    const leaderboard = (profiles || []).map((profile, index) => ({
      rank: index + 1,
      userId: profile.id,
      username: profile.username || 'Anonymous',
      fullName: profile.display_name,
      avatarUrl: profile.avatar_url,
      points: profile.points || 0,
      level: profile.level || 1,
      badges: [] as unknown[],
      isCurrentUser: userId === profile.id,
    }))

    let currentUserRank = null
    if (userId) {
      const userIndex = leaderboard.findIndex((u) => u.userId === userId)
      if (userIndex !== -1) {
        currentUserRank = {
          ...leaderboard[userIndex],
          rank: userIndex + 1,
        }
      } else {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, points, level')
          .eq('id', userId)
          .single()

        if (userProfile) {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('points', userProfile.points || 0)

          currentUserRank = {
            rank: (count || 0) + 1,
            userId: userProfile.id,
            username: userProfile.username || 'Anonymous',
            fullName: userProfile.display_name,
            avatarUrl: userProfile.avatar_url,
            points: userProfile.points || 0,
            level: userProfile.level || 1,
            badges: [] as unknown[],
            isCurrentUser: true,
          }
        }
      }
    }

    const response = {
      period,
      leaderboard,
      currentUserRank,
      timestamp: new Date().toISOString(),
    }

    await Promise.race([
      setCache(cacheKey, response, 300),
      new Promise<void>((resolve) => setTimeout(resolve, cacheTimeoutMs)),
    ])

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Leaderboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
