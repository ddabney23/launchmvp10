import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabase-auth';
import { createServerClient } from '@/integrations/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().min(3).max(100).optional(),
  content: z.string().min(10).max(2000).optional(),
  images: z.array(z.string().url()).max(5).optional(),
});

/**
 * PATCH /api/reviews/[id]
 * Update a review
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    const supabase = await createServerClient();

    const { id: reviewId } = await context.params;

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateReviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile:', profileError);
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if review exists and belongs to user
    const { data: existingReview, error: reviewError } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (reviewError || !existingReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    if (existingReview.user_id !== profile.id) {
      return NextResponse.json(
        { error: 'Cannot update another user\'s review' },
        { status: 403 }
      );
    }

    // Sanitize content if provided
    const sanitizedUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title) {
      sanitizedUpdates.title = sanitizeString(updates.title, { maxLength: 100 });
    }

    if (updates.content) {
      sanitizedUpdates.content = sanitizeString(updates.content, { maxLength: 2000, preserveNewlines: true });
    }

    if (updates.rating !== undefined) {
      sanitizedUpdates.rating = updates.rating;
    }

    if (updates.images !== undefined) {
      sanitizedUpdates.images = updates.images;
    }

    // Update review
    const { data: review, error: updateError } = await supabase
      .from('reviews')
      .update(sanitizedUpdates)
      .eq('id', reviewId)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to update review:', updateError);
      return NextResponse.json(
        { error: 'Failed to update review' },
        { status: 500 }
      );
    }

    // If rating changed, update listing average rating
    if (updates.rating !== undefined) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('listing_id', existingReview.listing_id);

      if (reviews) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

        await supabase
          .from('listings')
          .update({ average_rating: avgRating })
          .eq('id', existingReview.listing_id);
      }
    }

    logger.info('Review updated successfully:', { reviewId, userId: profile.id });

    return NextResponse.json({
      success: true,
      review,
    });
  } catch (error) {
    logger.error('Review update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reviews/[id]
 * Delete a review
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    const supabase = await createServerClient();

    const { id: reviewId } = await context.params;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile:', profileError);
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if review exists and belongs to user
    const { data: existingReview, error: reviewError } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (reviewError || !existingReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    if (existingReview.user_id !== profile.id) {
      return NextResponse.json(
        { error: 'Cannot delete another user\'s review' },
        { status: 403 }
      );
    }

    // Delete review
    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (deleteError) {
      logger.error('Failed to delete review:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete review' },
        { status: 500 }
      );
    }

    // Update listing average rating and count
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('listing_id', existingReview.listing_id);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await supabase
        .from('listings')
        .update({
          average_rating: avgRating,
          review_count: reviews.length,
        })
        .eq('id', existingReview.listing_id);
    } else {
      // No reviews left, reset to null
      await supabase
        .from('listings')
        .update({
          average_rating: null,
          review_count: 0,
        })
        .eq('id', existingReview.listing_id);
    }

    logger.info('Review deleted successfully:', { reviewId, userId: profile.id });

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    logger.error('Review deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



