import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabase-auth';
import { createServerClient } from '@/integrations/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

const CreateReviewSchema = z.object({
  listingId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(100),
  content: z.string().min(10).max(2000),
  images: z.array(z.string().url()).max(5).optional(),
});

/**
 * POST /api/reviews
 * Create a new review
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const supabase = await createServerClient();

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateReviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { listingId, orderId, rating, title, content, images } = validation.data;

    const profileId = userId;

    // Check if listing exists
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, vendor_id, title')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      logger.error('Listing not found:', listingError);
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Prevent self-review
    if (listing.vendor_id === profileId) {
      return NextResponse.json(
        { error: 'Cannot review your own listing' },
        { status: 400 }
      );
    }

    // Check if user already reviewed this listing
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('listing_id', listingId)
      .eq('user_id', profileId)
      .single();

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this listing' },
        { status: 400 }
      );
    }

    // Sanitize content
    const sanitizedTitle = sanitizeString(title, { maxLength: 100 });
    const sanitizedContent = sanitizeString(content, { maxLength: 2000, preserveNewlines: true });

    // Create review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        listing_id: listingId,
        order_id: orderId,
        user_id: profileId,
        rating,
        title: sanitizedTitle,
        content: sanitizedContent,
        images: images || [],
        verified_purchase: !!orderId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (reviewError) {
      logger.error('Failed to create review:', reviewError);
      return NextResponse.json(
        { error: 'Failed to create review' },
        { status: 500 }
      );
    }

    // Update listing average rating
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('listing_id', listingId);

    if (reviews) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      const reviewCount = reviews.length;

      await supabase
        .from('listings')
        .update({
          average_rating: avgRating,
          review_count: reviewCount,
        })
        .eq('id', listingId);
    }

    // Award points for reviewing
    await supabase.rpc('award_points', {
      p_user_id: profileId,
      p_points: 5,
      p_reason: 'product_review',
    }).catch((err) => logger.warn('Failed to award points:', err));

    // TODO: Send notification to vendor

    logger.info('Review created successfully:', { reviewId: review.id, listingId, userId: profileId });

    return NextResponse.json({
      success: true,
      review,
    });
  } catch (error) {
    logger.error('Review creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews?listingId=xxx&page=1&limit=10
 * Get reviews for a listing
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const searchParams = request.nextUrl.searchParams;
    const listingId = searchParams.get('listingId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const sortBy = searchParams.get('sortBy') || 'recent'; // recent, rating_high, rating_low, helpful

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('reviews')
      .select(`
        *,
        profile:profiles!reviews_user_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('listing_id', listingId);

    // Apply sorting
    if (sortBy === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'rating_high') {
      query = query.order('rating', { ascending: false });
    } else if (sortBy === 'rating_low') {
      query = query.order('rating', { ascending: true });
    } else if (sortBy === 'helpful') {
      query = query.order('helpful_count', { ascending: false });
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    // Calculate rating distribution
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('listing_id', listingId);

    const ratingDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    if (allReviews) {
      allReviews.forEach((review) => {
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({
      reviews: reviews || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasMore: page < totalPages,
      },
      ratingDistribution,
    });
  } catch (error) {
    logger.error('Reviews fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



