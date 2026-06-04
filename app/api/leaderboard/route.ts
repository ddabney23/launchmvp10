import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUser } from '@/lib/supabase-auth'
import { getCache, setCache } from '@/lib/cache'
import { logger } from '@/lib/logger'

interface ProfileLeaderboardRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  points: number | null
  level: number | null
}

function getPeriodDateFilter(period: string) {
  const date = new Date()

  if (period === 'monthly') {
    date.setMonth(date.getMonth() - 1)
    return date
  }

  if (period === 'weekly') {
    date.setDate(date.getDate() - 7)
    return date
  }

  return null
}

function formatEntry(profile: ProfileLeaderboardRow, rank: number, currentUserId?: string) {
  return {
    rank,
    userId: profile.id,
    username: profile.username || 'Anonymous',
    fullName: profile.display_name,
    avatarUrl: profile.avatar_url,
    points: profile.points || 0,
    level: profile.level || 1,
    badges: [],
    isCurrentUser: currentUserId === profile.id,
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const authUser = await getAuthUser().catch(() => null)
    const userId = authUser?.id

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'all_time'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const cacheKey = `leaderboard:${period}:${limit}:${userId || 'anonymous'}`

    const cached = await getCache(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const dateFilter = getPeriodDateFilter(period)
    let query = adminClient
      .from('profiles')
      .select('id, username, display_name, avatar_url, points, level')
      .order('points', { ascending: false })
      .limit(limit)

    if (dateFilter) {
      query = query.gte('updated_at', dateFilter.toISOString())
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to fetch leaderboard', error)
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    }

    const profiles = (data || []) as ProfileLeaderboardRow[]
    const leaderboard = profiles.map((profile, index) =>
      formatEntry(profile, index + 1, userId)
    )

    let currentUserRank = null
    if (userId) {
      currentUserRank = leaderboard.find((entry) => entry.userId === userId) || null

      if (!currentUserRank) {
        const { data: userProfileData } = await adminClient
          .from('profiles')
          .select('id, username, display_name, avatar_url, points, level')
          .eq('id', userId)
          .maybeSingle()

        const userProfile = userProfileData as ProfileLeaderboardRow | null
        if (userProfile) {
          const { count } = await adminClient
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('points', userProfile.points || 0)

          currentUserRank = formatEntry(userProfile, (count || 0) + 1, userId)
        }
      }
    }

    const response = {
      period,
      leaderboard,
      currentUserRank,
      timestamp: new Date().toISOString(),
    }

    await setCache(cacheKey, response, 300)
    return NextResponse.json(response)
  } catch (error) {
    logger.error('Leaderboard API error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
