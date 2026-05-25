import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  try {
    const { pollId } = await params
    const body = await req.json()
    const optionId = body?.optionId as string

    if (!pollId || !optionId) {
      return NextResponse.json({ error: 'Poll ID and option ID are required' }, { status: 400 })
    }

    const userId = await getAuthUserId()
    const supabase = createAdminClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: option, error: optionError } = await supabase
      .from('poll_options')
      .select('poll_id, vote_count')
      .eq('id', optionId)
      .single()

    if (optionError || !option || option.poll_id !== pollId) {
      return NextResponse.json({ error: 'Invalid poll option' }, { status: 400 })
    }

    const { error: voteError } = await supabase
      .from('poll_votes')
      .insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: profile.id,
      })

    if (voteError) {
      if (voteError.code === '23505') {
        return NextResponse.json({ error: 'You have already voted on this poll' }, { status: 400 })
      }
      logger.error('Failed to record poll vote', voteError)
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
    }

    await supabase
      .from('poll_options')
      .update({ vote_count: (option.vote_count || 0) + 1 })
      .eq('id', optionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Poll vote error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

