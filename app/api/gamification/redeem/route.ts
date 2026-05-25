import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { createServerClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const RedeemSchema = z.object({
  rewardId: z.string().uuid(),
  credits: z.number().int().positive(),
})

/**
 * POST /api/gamification/redeem
 * Redeem credits for rewards
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const supabase = await createServerClient()

    const body = await request.json()
    const validation = RedeemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { rewardId, credits } = validation.data

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, credits, username, email')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile:', profileError)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const currentCredits = profile.credits || 0
    if (currentCredits < credits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: credits,
          available: currentCredits,
        },
        { status: 400 }
      )
    }

    const rewardCatalog = {
      'discount-5': { id: 'discount-5', name: '5% Discount', credits: 50, type: 'discount', value: 5 },
      'discount-10': { id: 'discount-10', name: '10% Discount', credits: 100, type: 'discount', value: 10 },
      'discount-15': { id: 'discount-15', name: '15% Discount', credits: 150, type: 'discount', value: 15 },
      'discount-20': { id: 'discount-20', name: '20% Discount', credits: 200, type: 'discount', value: 20 },
      'free-shipping': { id: 'free-shipping', name: 'Free Shipping', credits: 75, type: 'shipping', value: 0 },
      'gift-card-10': { id: 'gift-card-10', name: '$10 Gift Card', credits: 500, type: 'gift_card', value: 10 },
      'gift-card-25': { id: 'gift-card-25', name: '$25 Gift Card', credits: 1000, type: 'gift_card', value: 25 },
      'gift-card-50': { id: 'gift-card-50', name: '$50 Gift Card', credits: 1800, type: 'gift_card', value: 50 },
    }

    const reward = Object.values(rewardCatalog).find((r) => r.id === rewardId)

    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    }

    if (reward.credits !== credits) {
      return NextResponse.json(
        { error: 'Invalid credit amount for this reward' },
        { status: 400 }
      )
    }

    const newCredits = currentCredits - credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', profile.id)

    if (updateError) {
      logger.error('Failed to update credits:', updateError)
      return NextResponse.json({ error: 'Failed to process redemption' }, { status: 500 })
    }

    const redemption = {
      user_id: profile.id,
      reward_id: rewardId,
      reward_name: reward.name,
      reward_type: reward.type,
      reward_value: reward.value,
      credits_spent: credits,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }

    logger.info('Credit redemption successful:', redemption)

    return NextResponse.json({
      success: true,
      message: 'Redemption successful',
      redemption: {
        id: `redemption_${Date.now()}`,
        ...redemption,
      },
      newBalance: newCredits,
    })
  } catch (error) {
    logger.error('Credit redemption error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/gamification/redeem
 * Get redemption history for current user
 */
export async function GET() {
  try {
    const userId = await getAuthUserId()
    const supabase = await createServerClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile:', profileError)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ redemptions: [] as never[] })
  } catch (error) {
    logger.error('Failed to fetch redemption history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
