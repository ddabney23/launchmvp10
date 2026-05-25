'use client'

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Plus, Edit, Trash2, TrendingUp, Package, Calendar, DollarSign, Store, Star, Trophy, CreditCard, Sparkles, Settings, Award, Users, Eye, Tag, Copy, Check, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVendorListings, deleteListing, getVendorProfile, getVendorDashboard, getUserBadges, getVendorCoupons, createCoupon, updateCoupon, deleteCoupon, type Coupon, type CouponCreate } from "@/lib/api";
import { getUserOrders, getUserBookings, getProfile } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ListingForm } from "@/components/vendor/ListingForm";
import { ListingCard } from "@/components/ListingCard";
import { VerifiedVendorBadge } from "@/components/VerifiedVendorBadge";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SubscriptionManagement } from "@/components/vendor/SubscriptionManagement";
import { StripeConnectOnboard } from "@/components/vendor/StripeConnectOnboard";
import { StoreSettings } from "@/components/vendor/StoreSettings";
import { VendorEarnings } from "@/components/vendor/VendorEarnings";
import { RefundManagement } from "@/components/vendor/RefundManagement";
import { VendorOrderManagement } from "@/components/vendor/VendorOrderManagement";
import { VendorAnalytics } from "@/components/vendor/VendorAnalytics";
import { ShippingLabelManager } from "@/components/vendor/ShippingLabelManager";

interface VendorDashboardProps {
  vendorId?: string;
}

export default function VendorDashboard({ vendorId: vendorIdProp }: VendorDashboardProps) {
  const router = useRouter();
  // Use vendorId prop if provided, otherwise try to get from URL (for backward compatibility)
  const id = vendorIdProp || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : undefined);
  const { toast } = useToast();
  const { user, profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "dashboard">("dashboard");
  const [dashboardTab, setDashboardTab] = useState<string>("listings"); // For dashboard sub-tabs
  const [isCreatePromoDialogOpen, setIsCreatePromoDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<string | null>(null);

  const couponForm = useForm<CouponCreate>({
    resolver: zodResolver(z.object({
      code: z.string().min(3).max(20),
      discount_type: z.enum(["percentage", "fixed"]),
      discount_value: z.number().min(0.01),
      min_purchase: z.number().min(0).optional(),
      max_discount: z.number().min(0).optional(),
      expires_at: z.string().optional(),
      usage_limit: z.number().int().min(1).optional(),
      active: z.boolean().optional(),
    })),
    defaultValues: {
      code: "",
      discount_type: "percentage",
      discount_value: 10,
      active: true,
    },
  });

  // If viewing another vendor's profile, use their ID, otherwise use current user's profile UUID
  // Prefer profile.id (UUID) over user.id (Clerk ID) for database queries
  const vendorId = id || currentProfile?.id || user?.id || vendorIdProp;
  const isOwner = !id || id === currentProfile?.id || id === user?.id;

  // If viewing another vendor, show public profile only
  useEffect(() => {
    if (!isOwner) {
      setActiveTab("profile");
    }
  }, [isOwner]);

  // Fetch vendor profile
  const { data: vendorProfile } = useQuery({
    queryKey: ["vendorProfile", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getVendorProfile(vendorId);
    },
    enabled: !!vendorId,
  });

  // Fetch vendor's public profile
  const { data: profile } = useQuery({
    queryKey: ["profile", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getProfile(vendorId);
    },
    enabled: !!vendorId,
  });

  // Fetch vendor dashboard stats (owner only)
  const { data: dashboardStats } = useQuery({
    queryKey: ["vendorDashboard", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getVendorDashboard(vendorId);
    },
    enabled: !!vendorId && isOwner,
  });

  // Fetch vendor badges
  const { data: badges } = useQuery({
    queryKey: ["vendorBadges", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getUserBadges(vendorId);
    },
    enabled: !!vendorId,
  });

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["listings", "vendor", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getVendorListings(vendorId);
    },
    enabled: !!vendorId,
  });

  // Calculate subscription info from vendorProfile and listings
  const subscriptionInfo = useMemo(() => {
    if (!vendorProfile || !listings) return null;
    
    const limit = vendorProfile.listing_limit ?? 5;
    const currentCount = listings.length;
    const hasUnlimited = limit === -1;
    
    return {
      tier: vendorProfile.subscription_tier || 'free',
      listingLimit: limit,
      currentListings: currentCount,
      hasUnlimitedListings: hasUnlimited,
      canCreateListing: hasUnlimited || currentCount < limit,
      remaining: hasUnlimited ? -1 : Math.max(0, limit - currentCount),
    };
  }, [vendorProfile, listings]);

  const { data: orders } = useQuery({
    queryKey: ["orders", "vendor", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getUserOrders(vendorId);
    },
    enabled: !!vendorId && isOwner,
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings", "vendor", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getUserBookings(vendorId);
    },
    enabled: !!vendorId && isOwner,
  });

  const { data: coupons, isLoading: couponsLoading } = useQuery({
    queryKey: ["coupons", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getVendorCoupons(vendorId);
    },
    enabled: !!vendorId && isOwner,
  });

  // Fetch vendor application status (for owner only)
  const { data: vendorStatus } = useQuery({
    queryKey: ["vendorStatus", vendorId],
    queryFn: async () => {
      const response = await fetch('/api/vendor/verify', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch vendor status');
      }
      const data = await response.json();
      return data.data || data;
    },
    enabled: !!vendorId && isOwner,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (listingId: string) => deleteListing(listingId),
    onSuccess: () => {
      // Invalidate all listing queries to refresh marketplace and dashboard
      queryClient.invalidateQueries({ queryKey: ["listings", "vendor", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "infinite"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "search"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "all"] });
      toast({ title: "Listing deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete listing",
        variant: "destructive",
      });
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: createCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", vendorId] });
      toast({ title: "Coupon created successfully" });
      setIsCreatePromoDialogOpen(false);
      couponForm.reset();
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create coupon",
        variant: "destructive",
      });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", vendorId] });
      toast({ title: "Coupon deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete coupon",
        variant: "destructive",
      });
    },
  });

  // Check if viewing own dashboard and is vendor
  if (isOwner && !currentProfile?.is_vendor && !currentProfile?.vendor_verified) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Vendor Dashboard</CardTitle>
              <CardDescription>
                You need to be a vendor to access this page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/onboarding/vendor")}>
                Apply to become a vendor
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const activeListings = listings?.filter((l) => l.active) || [];
  const publicListings = listings?.filter((l) => l.active) || [];
  const totalSales = orders?.reduce((sum, order) => {
    if (order.status === "completed" || order.status === "paid") {
      return sum + Number(order.total || 0);
    }
    return sum;
  }, 0) || 0;

  const pendingBookings = bookings?.filter((b) => b.status === "pending") || [];
  const confirmedBookings = bookings?.filter((b) => b.status === "confirmed") || [];

  // Determine vendor status for banner
  const isPendingApproval = isOwner && 
    currentProfile?.is_vendor && 
    !currentProfile?.vendor_verified &&
    (!vendorStatus?.isVerified);

  const applicationStatus = vendorStatus?.application?.status;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Pending Approval Banner */}
              {isPendingApproval && (
                <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <AlertTitle className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200">Pending Approval</AlertTitle>
                    <AlertDescription className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
                      Your vendor application is under review. You'll be notified once approved.
                      {applicationStatus === 'denied' && vendorStatus?.application?.denial_reason && (
                        <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-xs sm:text-sm break-words">
                          <strong>Reason:</strong> {vendorStatus.application.denial_reason}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Public Profile Header */}
              <Card>
                <div className="relative h-32 sm:h-40 md:h-48 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg">
                  {vendorProfile && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-6">
                      <div className="flex items-end gap-2 sm:gap-3 md:gap-4">
                        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 ring-2 sm:ring-4 ring-background flex-shrink-0">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-lg sm:text-xl md:text-2xl">
                            {profile?.username?.[0]?.toUpperCase() || "V"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 pb-1 sm:pb-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                            <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate flex-1 min-w-0">{vendorProfile.business_name || profile?.display_name || profile?.username}</h1>
                            {profile?.vendor_verified && (
                              <VerifiedVendorBadge size="sm" className="flex-shrink-0" />
                            )}
                          </div>
                          {profile?.bio && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>}
                        </div>
                        {/* View Store Profile Button */}
                        {isOwner && currentProfile?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0 min-h-[44px]"
                            onClick={() => {
                              // Navigate to the store profile page
                              const profileId = currentProfile.id || vendorId
                              router.push(`/vendor/${profileId}`)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">View Store</span>
                            <span className="sm:hidden">View</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Tabs */}
              <Tabs 
                value={isOwner ? activeTab : "profile"} 
                onValueChange={(value) => {
                  if (value === "profile" || value === "dashboard") {
                    setActiveTab(value as "profile" | "dashboard")
                  }
                }} 
                className="space-y-4"
              >
                <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-none">
                  <TabsTrigger 
                    value="profile" 
                    className="text-xs sm:text-sm cursor-pointer"
                  >
                    <Store className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Store Profile</span>
                    <span className="sm:hidden">Store</span>
                  </TabsTrigger>
                  {isOwner && (
                    <TabsTrigger 
                      value="dashboard" 
                      className="text-xs sm:text-sm cursor-pointer"
                    >
                      <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Dashboard
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Public Profile Tab */}
                <TabsContent value="profile" className="space-y-6">
                  {/* Store Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>About This Store</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {vendorProfile?.business_name && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Business Name</p>
                            <p className="text-lg">{vendorProfile.business_name}</p>
                          </div>
                        )}
                        {profile?.bio && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Description</p>
                            <p className="text-sm">{profile.bio}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div>
                            <p className="text-xs sm:text-sm font-medium text-muted-foreground">Listings</p>
                            <p className="text-xl sm:text-2xl font-bold">{publicListings.length}</p>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-medium text-muted-foreground">Points</p>
                            <p className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-1">
                              <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                              {profile?.points || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Products */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Products</CardTitle>
                      <CardDescription>Available items from this vendor</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {listingsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : publicListings.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          No products available yet
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {publicListings.map((listing) => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              currentUserId={user?.id}
                              onAddToCart={() => {}}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Private Dashboard Tab */}
                {isOwner && (
                  <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
                      <h2 className="text-xl sm:text-2xl font-bold">Dashboard</h2>
                      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full sm:w-auto min-h-[44px]">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Listing
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" aria-describedby="create-listing-description">
                          <DialogHeader>
                            <DialogTitle>Create New Listing</DialogTitle>
                            <DialogDescription id="create-listing-description">
                              Add a new product or service to your marketplace
                            </DialogDescription>
                          </DialogHeader>
                          <ListingForm
                            onSuccess={() => {
                              setIsCreateDialogOpen(false);
                              // Invalidate all listing queries to refresh marketplace and dashboard
                              queryClient.invalidateQueries({ queryKey: ["listings", "vendor", vendorId] });
                              queryClient.invalidateQueries({ queryKey: ["listings"] });
                              queryClient.invalidateQueries({ queryKey: ["listings", "infinite"] });
                              queryClient.invalidateQueries({ queryKey: ["listings", "search"] });
                              queryClient.invalidateQueries({ queryKey: ["listings", "all"] });
                            }}
                            onLimitReached={() => {
                              // Close the create dialog and switch to subscription tab
                              setIsCreateDialogOpen(false);
                              // Switch to subscription tab in the dashboard
                              setDashboardTab("subscription");
                              // Ensure we're on the dashboard tab
                              setActiveTab("dashboard");
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Total Listings</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-muted-foreground" />
                            <p className="text-2xl font-bold">{listings?.length || 0}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activeListings.length} active
                          </p>
                          {subscriptionInfo && (
                            <div className="mt-2 pt-2 border-t">
                              {subscriptionInfo.hasUnlimitedListings ? (
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  ✓ Unlimited listings
                                </p>
                              ) : subscriptionInfo.remaining !== undefined ? (
                                <p className={`text-xs font-medium ${
                                  subscriptionInfo.remaining === 0 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : subscriptionInfo.remaining <= 2
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-muted-foreground'
                                }`}>
                                  {subscriptionInfo.remaining === 0 ? (
                                    <span>⚠️ Limit reached ({subscriptionInfo.currentListings}/{subscriptionInfo.listingLimit})</span>
                                  ) : (
                                    <span>{subscriptionInfo.remaining} remaining ({subscriptionInfo.currentListings}/{subscriptionInfo.listingLimit})</span>
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {subscriptionInfo.currentListings || 0}/{subscriptionInfo.listingLimit} listings
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Total Sales</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <p className="text-2xl font-bold">${totalSales.toFixed(2)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            All time
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Pending Bookings</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <p className="text-2xl font-bold">{pendingBookings.length}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {confirmedBookings.length} confirmed
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Performance</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-muted-foreground" />
                            <p className="text-2xl font-bold">--</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Views this month
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Dashboard Tabs */}
                    <Tabs value={dashboardTab} onValueChange={(value) => setDashboardTab(value)} className="space-y-4">
                      <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-1">
                        <TabsTrigger value="listings" className="text-xs sm:text-sm">Listings</TabsTrigger>
                        <TabsTrigger value="orders" className="text-xs sm:text-sm">Orders</TabsTrigger>
                        <TabsTrigger value="bookings" className="text-xs sm:text-sm">Bookings</TabsTrigger>
                        <TabsTrigger value="promotions" className="text-xs sm:text-sm">Promotions</TabsTrigger>
                        <TabsTrigger value="subscription" className="text-xs sm:text-sm">Subscription</TabsTrigger>
                        <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
                        <TabsTrigger value="shipping" className="text-xs sm:text-sm">Shipping</TabsTrigger>
                        <TabsTrigger value="store-settings" className="text-xs sm:text-sm">Store</TabsTrigger>
                      </TabsList>

                      <TabsContent value="listings" className="space-y-4">
                        {listingsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : listings && listings.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {listings.map((listing) => (
                              <Card key={listing.id}>
                                <div className="aspect-square bg-muted overflow-hidden rounded-t-lg">
                                  {listing.images && listing.images.length > 0 ? (
                                    <img
                                      src={listing.images[0]}
                                      alt={listing.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <CardHeader>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <CardTitle className="text-lg">{listing.title}</CardTitle>
                                      <CardDescription className="mt-1">
                                        ${Number(listing.price).toFixed(2)}
                                      </CardDescription>
                                    </div>
                                    <Badge variant={listing.active ? "default" : "secondary"}>
                                      {listing.active ? "Active" : "Inactive"}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 min-h-[44px]"
                                      onClick={() => router.push(`/listing/${listing.id}`)}
                                    >
                                      View
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="min-h-[44px] min-w-[44px]"
                                      onClick={() => setEditingListing(listing.id)}
                                      aria-label="Edit listing"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="min-h-[44px] min-w-[44px]"
                                      onClick={() => {
                                        if (confirm("Delete this listing?")) {
                                          deleteMutation.mutate(listing.id);
                                        }
                                      }}
                                      aria-label="Delete listing"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <Package className="h-12 w-12 text-muted-foreground mb-4" />
                              <p className="text-muted-foreground mb-4">No listings yet</p>
                              <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Your First Listing
                              </Button>
                            </CardContent>
                          </Card>
                        )}

                      {editingListing && (
                        <Dialog open={!!editingListing} onOpenChange={(open) => !open && setEditingListing(null)}>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-listing-description">
                            <DialogHeader>
                              <DialogTitle>Edit Listing</DialogTitle>
                              <DialogDescription id="edit-listing-description">
                                Update your listing details
                              </DialogDescription>
                            </DialogHeader>
                            <ListingForm
                              listingId={editingListing}
                              onSuccess={() => {
                                setEditingListing(null);
                                // Invalidate all listing queries to refresh marketplace and dashboard
                                queryClient.invalidateQueries({ queryKey: ["listings", "vendor", vendorId] });
                                queryClient.invalidateQueries({ queryKey: ["listings"] });
                                queryClient.invalidateQueries({ queryKey: ["listings", "infinite"] });
                                queryClient.invalidateQueries({ queryKey: ["listings", "search"] });
                                queryClient.invalidateQueries({ queryKey: ["listings", "all"] });
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                      )}
                      </TabsContent>

                      <TabsContent value="orders" className="space-y-4">
                        {isOwner && vendorId ? (
                          <VendorOrderManagement vendorId={vendorId} />
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <p className="text-muted-foreground">No orders yet</p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      <TabsContent value="bookings" className="space-y-4">
                        {bookings && bookings.length > 0 ? (
                          <div className="space-y-4">
                            {bookings.map((booking) => (
                              <Card key={booking.id}>
                                <CardHeader>
                                  <div className="flex items-center justify-between">
                                    <CardTitle>Booking</CardTitle>
                                    <Badge>{booking.status}</Badge>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2">
                                    <p className="text-sm">
                                      <span className="font-semibold">Start:</span>{" "}
                                      {booking.start_time ? format(new Date(booking.start_time), "PPp") : ""}
                                    </p>
                                    <p className="text-sm">
                                      <span className="font-semibold">End:</span>{" "}
                                      {booking.end_time ? format(new Date(booking.end_time), "PPp") : ""}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <p className="text-muted-foreground">No bookings yet</p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      <TabsContent value="promotions" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Coupons & Promotions</h3>
                            <p className="text-sm text-muted-foreground">Create discount codes and special offers</p>
                          </div>
                          <Dialog open={isCreatePromoDialogOpen} onOpenChange={setIsCreatePromoDialogOpen}>
                            <DialogTrigger asChild>
                              <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Coupon
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create New Coupon</DialogTitle>
                                <DialogDescription>
                                  Create a discount code for your customers
                                </DialogDescription>
                              </DialogHeader>
                              <form onSubmit={couponForm.handleSubmit((data) => createCouponMutation.mutate(data))} className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="code">Coupon Code *</Label>
                                  <Input
                                    id="code"
                                    {...couponForm.register("code")}
                                    placeholder="e.g., SUMMER2024"
                                    className="uppercase"
                                  />
                                  {couponForm.formState.errors.code && (
                                    <p className="text-sm text-destructive">{couponForm.formState.errors.code.message}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="discount_type">Discount Type *</Label>
                                  <Select
                                    value={couponForm.watch("discount_type")}
                                    onValueChange={(value: "percentage" | "fixed") => couponForm.setValue("discount_type", value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="discount_value">Discount Value *</Label>
                                  <Input
                                    id="discount_value"
                                    type="number"
                                    step="0.01"
                                    {...couponForm.register("discount_value", { valueAsNumber: true })}
                                    placeholder="10"
                                  />
                                  {couponForm.formState.errors.discount_value && (
                                    <p className="text-sm text-destructive">{couponForm.formState.errors.discount_value.message}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="min_purchase">Minimum Purchase (optional)</Label>
                                  <Input
                                    id="min_purchase"
                                    type="number"
                                    step="0.01"
                                    {...couponForm.register("min_purchase", { valueAsNumber: true })}
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="max_discount">Max Discount (optional, for percentage)</Label>
                                  <Input
                                    id="max_discount"
                                    type="number"
                                    step="0.01"
                                    {...couponForm.register("max_discount", { valueAsNumber: true })}
                                    placeholder="50.00"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="expires_at">Expires At (optional)</Label>
                                  <Input
                                    id="expires_at"
                                    type="date"
                                    {...couponForm.register("expires_at")}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="usage_limit">Usage Limit (optional)</Label>
                                  <Input
                                    id="usage_limit"
                                    type="number"
                                    {...couponForm.register("usage_limit", { valueAsNumber: true })}
                                    placeholder="100"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id="active"
                                    checked={couponForm.watch("active")}
                                    onChange={(e) => couponForm.setValue("active", e.target.checked)}
                                    className="rounded"
                                  />
                                  <Label htmlFor="active">Active</Label>
                                </div>
                                <Button
                                  type="submit"
                                  className="w-full"
                                  disabled={createCouponMutation.isPending}
                                >
                                  {createCouponMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Creating...
                                    </>
                                  ) : (
                                    "Create Coupon"
                                  )}
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>

                        <Card>
                          <CardHeader>
                            <CardTitle>Active Coupons</CardTitle>
                            <CardDescription>Manage your discount codes</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {couponsLoading ? (
                              <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              </div>
                            ) : coupons && coupons.length > 0 ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {coupons.map((coupon) => (
                                    <Card key={coupon.id} className="border-2">
                                      <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-primary" />
                                            <CardTitle className="text-lg">{coupon.code}</CardTitle>
                                          </div>
                                          <Badge variant={coupon.active ? "default" : "secondary"}>
                                            {coupon.active ? "Active" : "Inactive"}
                                          </Badge>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="space-y-3">
                                        <div>
                                          <p className="text-sm text-muted-foreground">Discount</p>
                                          <p className="text-xl font-bold">
                                            {coupon.discount_type === "percentage"
                                              ? `${coupon.discount_value}% OFF`
                                              : `$${coupon.discount_value} OFF`}
                                          </p>
                                        </div>
                                        {coupon.min_purchase && (
                                          <p className="text-xs text-muted-foreground">
                                            Min purchase: ${coupon.min_purchase}
                                          </p>
                                        )}
                                        {coupon.expires_at && (
                                          <p className="text-xs text-muted-foreground">
                                            Expires: {format(new Date(coupon.expires_at), "MMM d, yyyy")}
                                          </p>
                                        )}
                                        {coupon.usage_limit && (
                                          <p className="text-xs text-muted-foreground">
                                            Used: {coupon.usage_count} / {coupon.usage_limit}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <Input
                                            value={coupon.code}
                                            readOnly
                                            className="font-mono text-sm"
                                          />
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                              navigator.clipboard.writeText(coupon.code);
                                              setCopiedCode(coupon.id);
                                              setTimeout(() => setCopiedCode(null), 2000);
                                              toast({
                                                title: "Copied!",
                                                description: "Coupon code copied to clipboard",
                                              });
                                            }}
                                          >
                                            {copiedCode === coupon.id ? (
                                              <Check className="h-4 w-4" />
                                            ) : (
                                              <Copy className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => setEditingCoupon(coupon.id)}
                                          >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Edit
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                              if (confirm("Delete this coupon?")) {
                                                deleteCouponMutation.mutate(coupon.id);
                                              }
                                            }}
                                            disabled={deleteCouponMutation.isPending}
                                          >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Delete
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-sm text-muted-foreground mb-4">No coupons yet</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsCreatePromoDialogOpen(true)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create Your First Coupon
                                </Button>
                              </div>
                            )}

                            <div className="p-4 bg-muted rounded-lg mt-4">
                              <p className="text-sm text-muted-foreground">
                                💡 <strong>Tip:</strong> Share coupon codes with your customers to boost sales. 
                                Track usage and performance in your analytics dashboard.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="analytics" className="space-y-4">
                        {isOwner && vendorId ? (
                          <VendorAnalytics vendorId={vendorId} />
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <p className="text-muted-foreground">Analytics available for store owners only</p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      <TabsContent value="subscription" className="space-y-4">
                        <SubscriptionManagement />
                      </TabsContent>

                      <TabsContent value="payments" className="space-y-4">
                        <StripeConnectOnboard />
                        {isOwner && vendorId && (
                          <>
                            <Separator />
                            <VendorEarnings vendorId={vendorId} />
                            <Separator />
                            <RefundManagement vendorId={vendorId} />
                          </>
                        )}
                      </TabsContent>

                      <TabsContent value="shipping" className="space-y-4">
                        <ShippingLabelManager />
                      </TabsContent>

                      <TabsContent value="store-settings" className="space-y-4">
                        <StoreSettings vendorId={vendorId} profile={profile} />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                )}
              </Tabs>
            </div>

            {/* Sidebar - Gamification */}
            <div className="lg:col-span-1 space-y-6">
              {isOwner && (
                <>
                  {/* Stats Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Your Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Sales</p>
                        <p className="text-2xl font-bold">${dashboardStats?.total_revenue?.toFixed(2) || "0.00"}</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground">Points</p>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-primary" />
                          <p className="text-2xl font-bold">{profile?.points || 0}</p>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground">Credits</p>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-secondary" />
                          <p className="text-2xl font-bold">{profile?.credits || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Badges Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Badges
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {badges && badges.length > 0 ? (
                        <div className="space-y-3">
                          {badges.slice(0, 5).map((badge) => (
                            <div key={badge.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Star className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{badge.name}</p>
                              </div>
                            </div>
                          ))}
                          {badges.length > 5 && (
                            <Button variant="outline" className="w-full" size="sm" asChild>
                              <Link href="/rewards">View All</Link>
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No badges yet
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Public View - Quick Actions */}
              {!isOwner && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/profile/${vendorId}`}>
                        <Users className="mr-2 h-4 w-4" />
                        View Profile
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/messages">
                        <Users className="mr-2 h-4 w-4" />
                        Message Vendor
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

