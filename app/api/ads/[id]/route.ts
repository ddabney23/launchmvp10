import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ensureAdminUser() {
  const userId = await getAuthUserId()
  const supabase = createAdminClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, is_admin')
    .eq('id', userId)
    .single()

  if (error || !profile?.is_admin) {
    throw new Error('FORBIDDEN')
  }

  return { supabase, profile }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await ensureAdminUser()
    const { id } = await params
    const body = await req.json()

    const { data, error } = await supabase
      .from('ads')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('Failed to update ad', error, { id })
      return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    logger.error('Ad update error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await ensureAdminUser()
    const { id } = await params

    const { error } = await supabase.from('ads').delete().eq('id', id)

    if (error) {
      logger.error('Failed to delete ad', error, { id })
      return NextResponse.json({ error: 'Failed to delete ad' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    logger.error('Ad delete error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

