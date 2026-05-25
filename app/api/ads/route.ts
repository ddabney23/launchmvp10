import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const placement = searchParams.get('placement') || 'feed'
  const includeAll = searchParams.get('all') === 'true'
  const now = new Date().toISOString()

  if (includeAll) {
    try {
      const userId = await getAuthUserId()
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let query = supabase.from('ads').select('*')

  if (!includeAll) {
    query = query
      .eq('is_active', true)
      .lte('start_at', now)
      .or(`end_at.is.null,end_at.gte.${now}`)
      .contains('placements', [placement])
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to fetch ads', error, { placement })
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .eq('id', userId)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title,
      description,
      image_url,
      cta_text,
      cta_url,
      placements = ['feed'],
      is_active = true,
      start_at,
      end_at,
    } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ads')
      .insert({
        title,
        description,
        image_url,
        cta_text,
        cta_url,
        placements,
        is_active,
        start_at: start_at || new Date().toISOString(),
        end_at,
        created_by: profile.id,
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create ad', error)
      return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    logger.error('Ad creation error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

