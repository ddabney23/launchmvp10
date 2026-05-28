'use client'

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Rss, Users, ShoppingBag, Gift, Sparkles, Trophy, CreditCard, Star, ArrowRight, Heart, Sparkle, Newspaper } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPersonalizedFeed, getRecommendedListings, getRecommendedVendors, getLeaderboard, getUserBadges, getFollowing } from "@/lib/api";
import { FeedPreviewCard } from "@/components/FeedPreviewCard";
import { ListingCard } from "@/components/ListingCard";
import { ContinueSection } from "@/components/home/ContinueSection";
import { NewsTeaser } from "@/components/home/NewsTeaser";
import type { PostWithAuthor } from "@/lib/types";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { SkeletonPost, SkeletonProfile, SkeletonListing } from "@/components/Skeleton";
import { AdsWidget } from "@/components/feed/widgets/AdsWidget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isOnboardingComplete } from "@/lib/profile-utils";

export default function Home() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { getItemCount, addToCart } = useCart();
  const queryClient = useQueryClient();

  // Fetch personalized feed (posts from people user follows)
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["personalizedFeed", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getPersonalizedFeed(user.id, 0, 10);
    },
    enabled: !!user?.id,
  });

  // Fetch recommended listings based on user's purchase history
  const { data: recommendedListings, isLoading: recommendedListingsLoading } = useQuery({
    queryKey: ["recommendedListings", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getRecommendedListings(user.id, 6);
    },
    enabled: !!user?.id,
  });

  // Fetch recommended vendors
  const { data: recommendedVendors, isLoading: recommendedVendorsLoading } = useQuery({
    queryKey: ["recommendedVendors", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getRecommendedVendors(user.id, 4);
    },
    enabled: !!user?.id,
  });

  // Fetch users you follow (for suggestions)
  const { data: followingData } = useQuery({
    queryKey: ["following", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getFollowing(user.id);
    },
    enabled: !!user?.id,
  });

  // Fetch top leaderboard
  const { data: leaderboardData } = useQuery({
    queryKey: ["leaderboard", "all_time"],
    queryFn: () => getLeaderboard("all_time", 5),
    enabled: !!user,
  });

  // Fetch user badges
  const { data: badgesData } = useQuery({
    queryKey: ["userBadges", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getUserBadges(user.id);
    },
    enabled: !!user?.id,
  });

  // Redirect to auth if not authenticated - use useEffect to avoid setState during render
  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/auth");
    }
  }, [authLoading, user?.id, profile?.id, router]);

  // Real-time subscription for new posts from users you follow
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const followingIds = followingData?.map((f) => f.id) || [];
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Subscribe to posts from users you follow (if any)
    let followingChannel: ReturnType<typeof supabase.channel> | null = null;
    if (followingIds.length > 0) {
      followingChannel = supabase
        .channel(`posts:home:following:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "posts",
            filter: `author=in.(${followingIds.join(",")})`,
          },
          () => {
            if (!isMounted) return;
            queryClient.invalidateQueries({ queryKey: ["personalizedFeed", user.id] });
          }
        )
        .subscribe((status, err) => {
          if (err) {
            // Only log actual errors, not connection status changes
            logger.warn('Realtime subscription error (non-critical)', { 
              status, 
              error: err.message || err,
              table: 'posts',
              filter: 'following'
            });
            return;
          }
          
          if (status === 'SUBSCRIBED') {
            logger.debug('Realtime subscribed to following posts');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // These are connection status changes, not errors - log as debug
            logger.debug('Realtime subscription status changed', { status, table: 'posts', filter: 'following' });
            // Attempt to resubscribe after a delay
            if (status === 'CLOSED' || status === 'TIMED_OUT') {
              setTimeout(() => {
                if (isMounted && followingChannel) {
                  logger.debug('Attempting to resubscribe to following posts');
                  followingChannel.subscribe();
                }
              }, 5000);
            }
          }
        });
      
      if (followingChannel) {
        channels.push(followingChannel);
      }
    }

    return () => {
      isMounted = false;
      channels.forEach((ch) => {
        try {
          supabase.removeChannel(ch);
        } catch (error) {
          logger.error('Error removing realtime channel', error);
        }
      });
    };
  }, [user?.id, followingData, queryClient]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <PageShell>
          <div className="mb-8">
            <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
            <div className="h-5 w-96 bg-muted animate-pulse rounded mt-2" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonPost key={i} />
              ))}
            </div>
            <div className="space-y-6">
              <SkeletonProfile />
              <SkeletonListing />
            </div>
          </div>
        </PageShell>
      </div>
    );
  }

  const posts = postsData || [];
  const recommendedProducts = recommendedListings || [];
  const recommendedStores = recommendedVendors || [];
  const following = followingData || [];
  const badges = badgesData || [];
  const topUsers = leaderboardData || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Welcome back, <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">{profile.display_name || profile.username}!</span>
              </h1>
              <p className="text-muted-foreground">Here's what's happening in your Optimix community</p>
            </div>
            <Link href="/create" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-linear-to-r from-primary to-secondary" aria-label="Create post">
                <Sparkles className="mr-2 h-4 w-4" />
                Create Post
              </Button>
            </Link>
          </div>
        </div>

        {profile && !isOnboardingComplete(profile) && (
          <Alert className="mb-6">
            <AlertTitle>Complete your profile</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Finish onboarding to unlock posting, marketplace checkout, and your full personalized feed.
              </span>
              <Link href="/onboarding">
                <Button variant="secondary" size="sm">
                  Continue setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <AdsWidget placement="home" className="mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <ContinueSection />
            <NewsTeaser />
            {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/rewards">
              <Card className="hover:bg-muted/50 transition-colors h-full">
                <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Points</p>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        <Trophy className="h-5 w-5 text-primary" />
                        {profile.points || 0}
                      </p>
                </CardContent>
              </Card>
              </Link>
              <Link href="/rewards">
              <Card className="hover:bg-muted/50 transition-colors h-full">
                <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Credits</p>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        <CreditCard className="h-5 w-5 text-secondary" />
                        {profile.credits || 0}
                      </p>
                </CardContent>
              </Card>
              </Link>
              <Link href="/rewards">
              <Card className="hover:bg-muted/50 transition-colors h-full">
                <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Badges</p>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        <Star className="h-5 w-5 text-yellow-500" />
                        {badges.length}
                      </p>
                </CardContent>
              </Card>
              </Link>
              <Link href="/cart">
              <Card className="hover:bg-muted/50 transition-colors h-full">
                <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Cart</p>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        <ShoppingBag className="h-5 w-5" />
                        {getItemCount()}
                      </p>
                </CardContent>
              </Card>
              </Link>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Navigate to key features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Link href="/feed">
                    <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                      <Rss className="h-5 w-5" />
                      <span>Feed</span>
                    </Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                      <ShoppingBag className="h-5 w-5" />
                      <span>Marketplace</span>
                    </Button>
                  </Link>
                  <Link href="/news">
                    <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                      <Newspaper className="h-5 w-5" />
                      <span>News</span>
                    </Button>
                  </Link>
                  <Link href="/groups">
                    <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                      <Users className="h-5 w-5" />
                      <span>Groups</span>
                    </Button>
                  </Link>
                  <Link href="/rewards">
                    <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                      <Gift className="h-5 w-5" />
                      <span>Rewards</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Personalized Feed */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkle className="h-5 w-5 text-primary" />
                    Feed highlights
                  </CardTitle>
                  <CardDescription>
                    Preview only — open Feed for the full community stream
                  </CardDescription>
                </div>
                <Link href="/feed">
                  <Button variant="ghost" size="sm">
                    See all in Feed <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {postsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {following.length === 0 ? (
                      <>
                        <p className="mb-4">Start following people to personalize your feed!</p>
                        <Link href="/feed">
                          <Button variant="outline" className="mt-2">
                            Go to Feed
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <p>No recent posts from people you follow.</p>
                        <Link href="/feed">
                          <Button variant="outline" className="mt-4">
                            Go to Feed
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.slice(0, 3).map((post) => (
                      <FeedPreviewCard key={post.id} post={post as PostWithAuthor} />
                    ))}
                    <Link href="/feed">
                      <Button variant="outline" className="w-full">
                        See all in Feed <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommended Products */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" />
                    Recommended for You
                  </CardTitle>
                  <CardDescription>
                    {recommendedProducts.length > 0 
                      ? "Based on your interests and purchase history"
                      : "Discover products you might love"}
                  </CardDescription>
                </div>
                <Link href="/marketplace">
                  <Button variant="ghost" size="sm">
                    Shop All <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {recommendedListingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : recommendedProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No recommendations yet. Start shopping to get personalized suggestions!</p>
                    <Link href="/marketplace">
                      <Button variant="outline" className="mt-4">
                        Browse Marketplace
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendedProducts.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        currentUserId={user.id}
                        onAddToCart={(id) => {
                          addToCart({
                            listing_id: id,
                            quantity: 1,
                            listing,
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommended Vendors */}
            {recommendedStores.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Stores You Might Like
                    </CardTitle>
                    <CardDescription>Vendors based on your shopping preferences</CardDescription>
                  </div>
                  <Link href="/marketplace">
                    <Button variant="ghost" size="sm">
                      View All <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {recommendedVendorsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {recommendedStores.map((vendor) => (
                        <Link key={vendor.id} href={`/store/${vendor.id}`}>
                          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardContent className="pt-6 flex flex-col items-center text-center">
                              <Avatar className="h-16 w-16 mb-3">
                                <AvatarImage src={vendor.avatar_url} />
                                <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-white">
                                  {vendor.username?.[0]?.toUpperCase() || "V"}
                                </AvatarFallback>
                              </Avatar>
                              <p className="font-medium text-sm truncate w-full">
                                {vendor.display_name || vendor.username}
                              </p>
                              {vendor.vendor_verified && (
                                <Badge variant="default" className="mt-2 text-xs">
                                  Verified
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Badges Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Your Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                {badges.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No badges yet. Start engaging to earn badges!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {badges.slice(0, 5).map((badge) => (
                      <div key={badge.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Star className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{badge.name}</p>
                          {badge.description && (
                            <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Link href="/rewards">
                  <Button variant="outline" className="w-full mt-4" size="sm">
                    View All Badges
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Top Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No leaderboard data yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topUsers.map((entry, index) => (
                      <div key={entry.user_id} className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 font-bold text-sm">
                          {index + 1}
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.profile?.avatar_url} />
                          <AvatarFallback>
                            {entry.profile?.username?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {entry.profile?.display_name || entry.profile?.username || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">{entry.points} pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Link href="/rewards">
                  <Button variant="outline" className="w-full mt-4" size="sm">
                    View Full Leaderboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell>
    </div>
  );
}

