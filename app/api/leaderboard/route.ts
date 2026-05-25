import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/integrations/supabase/server';
import { getAuthUser } from '@/lib/supabase-auth';
import { getCache, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

/**
 * GET /api/leaderboard
 * Get top users by points with optional time period filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const authUser = await getAuthUser();
    const userId = authUser?.id;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'all-time'; // all-time, monthly, weekly
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Create cache key
    const cacheKey = `leaderboard:${period}:${limit}`;

    // Try to get from cache (5 minute TTL)
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.debug('Returning cached leaderboard data');
      return NextResponse.json(cached);
    }

    // Calculate date filter based on period
    let dateFilter: Date | null = null;
    if (period === 'monthly') {
      dateFilter = new Date();
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    } else if (period === 'weekly') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    }

    // Build query
    let query = supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, points, level, badges')
      .order('points', { ascending: false })
      .limit(limit);

    // Apply date filter if specified
    if (dateFilter) {
      query = query.gte('updated_at', dateFilter.toISOString());
    }

    const { data: profiles, error } = await query;

    if (error) {
      logger.error('Failed to fetch leaderboard:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      );
    }

    // Calculate ranks and format response
    const leaderboard = profiles.map((profile, index) => ({
      rank: index + 1,
      userId: profile.id,
      username: profile.username || 'Anonymous',
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      points: profile.points || 0,
      level: profile.level || 1,
      badges: profile.badges || [],
      isCurrentUser: userId === profile.id,
    }));

    // Get current user's rank if authenticated
    let currentUserRank = null;
    if (userId) {
      const userIndex = leaderboard.findIndex(u => u.userId === userId);
      if (userIndex !== -1) {
        currentUserRank = {
          ...leaderboard[userIndex],
          rank: userIndex + 1,
        };
      } else {
        // User not in top N, fetch their actual rank
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, points, level, badges')
          .eq('id', userId)
          .single();

        if (userProfile) {
          // Count how many users have more points
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('points', userProfile.points || 0);

          currentUserRank = {
            rank: (count || 0) + 1,
            userId: userProfile.id,
            username: userProfile.username || 'Anonymous',
            fullName: userProfile.full_name,
            avatarUrl: userProfile.avatar_url,
            points: userProfile.points || 0,
            level: userProfile.level || 1,
            badges: userProfile.badges || [],
            isCurrentUser: true,
          };
        }
      }
    }

    const response = {
      period,
      leaderboard,
      currentUserRank,
      timestamp: new Date().toISOString(),
    };

    // Cache the response for 5 minutes
    await setCache(cacheKey, response, 300);

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Leaderboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

