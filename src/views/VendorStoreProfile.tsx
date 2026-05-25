'use client'

import { useState, useEffect } from "react";
import { setLastStorePath } from "@/components/home/ContinueSection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerifiedVendorBadge } from "@/components/VerifiedVendorBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Grid, Users, ShoppingBag, Star, MapPin, Mail, Phone, Globe, Calendar, Package, TrendingUp, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, getVendorListings, followUser, unfollowUser, isFollowing, getFollowers, getStoreReviews } from "@/lib/api";
import { ListingCard } from "@/components/ListingCard";
import { SkeletonListing } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface VendorStoreProfileProps {
  vendorId: string;
}

export default function VendorStoreProfile({ vendorId }: VendorStoreProfileProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");

  useEffect(() => {
    setLastStorePath(`/store/${vendorId}`);
  }, [vendorId]);

  // Fetch vendor profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", vendorId],
    queryFn: () => getProfile(vendorId),
    enabled: !!vendorId,
  });

  // Fetch vendor listings
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["listings", "vendor", vendorId],
    queryFn: () => getVendorListings(vendorId),
    enabled: !!vendorId,
  });

  // Check if current user is following this vendor
  const { data: isFollowingData } = useQuery({
    queryKey: ["isFollowing", user?.id, vendorId],
    queryFn: () => {
      if (!user?.id || !vendorId || user.id === vendorId) return false;
      return isFollowing(user.id, vendorId);
    },
    enabled: !!user?.id && !!vendorId && user.id !== vendorId,
  });

  // Get followers count
  const { data: followers } = useQuery({
    queryKey: ["followers", vendorId],
    queryFn: () => getFollowers(vendorId),
    enabled: !!vendorId,
  });

  // Get store stats
  const { data: storeStats } = useQuery({
    queryKey: ["storeStats", vendorId],
    queryFn: async () => {
      // Get total products
      const { count: totalProducts } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("vendor", vendorId)
        .eq("active", true);

      // Get total sales (completed orders)
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .eq("vendor", vendorId)
        .in("status", ["paid", "completed"]);

      // Get average rating (if reviews exist)
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .eq("vendor_id", vendorId);

      const avgRating = reviews && reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

      return {
        totalProducts: totalProducts || 0,
        totalSales: orders?.length || 0,
        rating: avgRating,
        reviewsCount: reviews?.length || 0,
        followersCount: followers?.length || 0,
      };
    },
    enabled: !!vendorId,
  });

  // Get store reviews
  const { data: reviews } = useQuery({
    queryKey: ["storeReviews", vendorId],
    queryFn: () => getStoreReviews(vendorId, 20),
    enabled: !!vendorId,
  });

  const isOwner = user?.id === profile?.id;
  const isVendor = profile?.is_vendor && profile?.vendor_verified;

  // Follow/Unfollow mutation
  const followMutation = useMutation({
    mutationFn: () => {
      if (!user?.id || !vendorId) throw new Error("Not authenticated");
      return isFollowingData ? unfollowUser(user.id, vendorId) : followUser(user.id, vendorId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", user?.id, vendorId] });
      queryClient.invalidateQueries({ queryKey: ["followers", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["storeStats", vendorId] });
      toast({
        title: isFollowingData ? "Unfollowed" : "Following",
        description: isFollowingData 
          ? `You're no longer following ${profile?.display_name || profile?.username}`
          : `You're now following ${profile?.display_name || profile?.username}`,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow status';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <PageShell>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Store Not Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                This vendor store doesn't exist or has been removed.
              </p>
              <Button onClick={() => router.push("/marketplace")}>
                Browse Marketplace
              </Button>
            </CardContent>
          </Card>
        </PageShell>
      </div>
    );
  }

  if (!isVendor) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <PageShell>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Not a Vendor Store</h3>
              <p className="text-muted-foreground text-center mb-4">
                This profile is not a verified vendor store.
              </p>
              <Button onClick={() => router.push(`/profile/${vendorId}`)}>
                View Profile
              </Button>
            </CardContent>
          </Card>
        </PageShell>
      </div>
    );
  }

  const activeListings = listings?.filter(l => l.active) || [];
  const bannerUrl = (profile as any).store_banner_url || null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Store Banner */}
      {bannerUrl && (
        <div className="relative h-64 md:h-80 w-full overflow-hidden">
          <img
            src={bannerUrl}
            alt={`${profile.display_name || profile.username} store banner`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background/80 to-transparent" />
        </div>
      )}

      <PageShell className={bannerUrl ? "pt-8" : undefined}>
        {/* Store Header */}
        <Card className={`mb-6 relative z-10 ${bannerUrl ? "-mt-20" : ""}`}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              {/* Avatar */}
              <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-3xl bg-linear-to-br from-primary to-secondary text-white">
                  {profile.username?.[0]?.toUpperCase() || "S"}
                </AvatarFallback>
              </Avatar>

              {/* Store Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {(profile as any).store_name || profile.display_name || profile.username}
                  </h1>
                  {profile.vendor_verified && <VerifiedVendorBadge />}
                </div>
                <p className="text-muted-foreground mb-4">
                  {(profile as any).store_description || profile.bio || "Welcome to our store!"}
                </p>

                {/* Store Stats */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {storeStats && (
                    <>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium">{storeStats.totalProducts}</span>
                        <span className="text-muted-foreground">Products</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="font-medium">{storeStats.totalSales}</span>
                        <span className="text-muted-foreground">Sales</span>
                      </div>
                      {storeStats.rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{storeStats.rating.toFixed(1)}</span>
                          <span className="text-muted-foreground">({storeStats.reviewsCount} reviews)</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-medium">{storeStats.followersCount}</span>
                        <span className="text-muted-foreground">Followers</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {!isOwner && user && (
                  <Button
                    variant={isFollowingData ? "outline" : "default"}
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                  >
                    <Heart className={`h-4 w-4 mr-2 ${isFollowingData ? "fill-current" : ""}`} />
                    {isFollowingData ? "Following" : "Follow Store"}
                  </Button>
                )}
                {isOwner && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/vendor/${vendorId}`)}
                  >
                    Manage Store
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href={`/profile/${vendorId}`}>
                    View Profile
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">
              <Grid className="h-4 w-4 mr-2" />
              Products ({activeListings.length})
            </TabsTrigger>
            <TabsTrigger value="about">
              <ShoppingBag className="h-4 w-4 mr-2" />
              About
            </TabsTrigger>
            {storeStats && storeStats.reviewsCount > 0 && (
              <TabsTrigger value="reviews">
                <Star className="h-4 w-4 mr-2" />
                Reviews ({storeStats.reviewsCount})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            {listingsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <SkeletonListing key={i} />
                ))}
              </div>
            ) : activeListings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Package className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Products Available</h3>
                  <p className="text-muted-foreground text-center">
                    This store doesn't have any products listed yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {activeListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    currentUserId={user?.id || undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Store Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(profile as any).store_description && (
                    <div>
                      <h4 className="font-semibold mb-2">Description</h4>
                      <p className="text-muted-foreground">
                        {(profile as any).store_description}
                      </p>
                    </div>
                  )}
                  {profile.bio && (
                    <div>
                      <h4 className="font-semibold mb-2">About</h4>
                      <p className="text-muted-foreground">{profile.bio}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact & Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{profile.email}</span>
                    </div>
                  )}
                  {(profile as any).store_location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{(profile as any).store_location}</span>
                    </div>
                  )}
                  {(profile as any).store_hours && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold mb-1">Store Hours</div>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify((profile as any).store_hours, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(profile as any).store_policies && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Store Policies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {JSON.stringify((profile as any).store_policies, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Reviews Tab */}
          {storeStats && storeStats.reviewsCount > 0 && (
            <TabsContent value="reviews">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Reviews</CardTitle>
                  <CardDescription>
                    Average rating: {storeStats.rating.toFixed(1)} / 5.0 ({storeStats.reviewsCount} {storeStats.reviewsCount === 1 ? 'review' : 'reviews'})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reviews && reviews.length > 0 ? (
                    reviews.map((review: any) => (
                      <div key={review.id} className="border-b pb-4 last:border-0">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={review.reviewer?.avatar_url || undefined} />
                            <AvatarFallback>
                              {review.reviewer?.username?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">
                                {review.reviewer?.display_name || review.reviewer?.username || "Anonymous"}
                              </span>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${
                                      i < (review.rating || 0)
                                        ? "fill-yellow-500 text-yellow-500"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(review.created_at || ""), { addSuffix: true })}
                              </span>
                            </div>
                            {review.comment && (
                              <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No reviews yet. Be the first to review this store!
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </PageShell>
    </div>
  );
}

