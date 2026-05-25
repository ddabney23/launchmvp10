'use client'

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getUserOrders, getVendorListings, getStoreReviews } from "@/lib/api";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Package, Star, Users, ShoppingCart } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface VendorAnalyticsProps {
  vendorId: string;
}

export function VendorAnalytics({ vendorId }: VendorAnalyticsProps) {
  // Fetch orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["vendorOrders", vendorId],
    queryFn: () => getUserOrders(vendorId),
    enabled: !!vendorId,
    select: (data) => data.filter(order => order.vendor === vendorId),
  });

  // Fetch listings
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["vendorListings", vendorId],
    queryFn: () => getVendorListings(vendorId),
    enabled: !!vendorId,
  });

  // Fetch reviews
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["storeReviews", vendorId],
    queryFn: () => getStoreReviews(vendorId, 100),
    enabled: !!vendorId,
  });

  const isLoading = ordersLoading || listingsLoading || reviewsLoading;

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!orders || !listings || !reviews) return null;

    const now = new Date();
    const last7Days = subDays(now, 7);
    const last30Days = subDays(now, 30);

    // Filter orders by date ranges
    const ordersLast7Days = orders.filter(order => {
      if (!order.created_at) return false;
      const orderDate = new Date(order.created_at);
      return orderDate >= startOfDay(last7Days) && orderDate <= endOfDay(now);
    });

    const ordersLast30Days = orders.filter(order => {
      if (!order.created_at) return false;
      const orderDate = new Date(order.created_at);
      return orderDate >= startOfDay(last30Days) && orderDate <= endOfDay(now);
    });

    // Revenue calculations
    const totalRevenue = orders
      .filter(o => ['paid', 'completed'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const revenueLast7Days = ordersLast7Days
      .filter(o => ['paid', 'completed'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const revenueLast30Days = ordersLast30Days
      .filter(o => ['paid', 'completed'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    // Order counts
    const totalOrders = orders.length;
    const ordersLast7DaysCount = ordersLast7Days.length;
    const ordersLast30DaysCount = ordersLast30Days.length;

    // Average order value
    const completedOrders = orders.filter(o => ['paid', 'completed'].includes(o.status));
    const avgOrderValue = completedOrders.length > 0
      ? totalRevenue / completedOrders.length
      : 0;

    // Conversion rate (orders / listings views - simplified)
    const activeListings = listings.filter(l => l.active).length;
    const conversionRate = activeListings > 0 && totalOrders > 0
      ? (totalOrders / activeListings) * 100
      : 0;

    // Reviews and ratings
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
      : 0;

    // Calculate growth rates
    const revenueGrowth7d = ordersLast7Days.length > 0
      ? ((revenueLast7Days / 7) - (revenueLast30Days / 30)) / (revenueLast30Days / 30) * 100
      : 0;

    const ordersGrowth7d = ordersLast7DaysCount > 0
      ? ((ordersLast7DaysCount / 7) - (ordersLast30DaysCount / 30)) / (ordersLast30DaysCount / 30) * 100
      : 0;

    return {
      totalRevenue,
      revenueLast7Days,
      revenueLast30Days,
      revenueGrowth7d,
      totalOrders,
      ordersLast7DaysCount,
      ordersLast30DaysCount,
      ordersGrowth7d,
      avgOrderValue,
      conversionRate,
      totalReviews,
      avgRating,
      activeListings,
      totalListings: listings.length,
    };
  }, [orders, listings, reviews]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold">${analytics.totalRevenue.toFixed(2)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 7 days: ${analytics.revenueLast7Days.toFixed(2)}
            </p>
            {analytics.revenueGrowth7d !== 0 && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${
                analytics.revenueGrowth7d > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {analytics.revenueGrowth7d > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(analytics.revenueGrowth7d).toFixed(1)}% vs 30d avg</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <p className="text-2xl font-bold">{analytics.totalOrders}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 7 days: {analytics.ordersLast7DaysCount}
            </p>
            {analytics.ordersGrowth7d !== 0 && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${
                analytics.ordersGrowth7d > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {analytics.ordersGrowth7d > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(analytics.ordersGrowth7d).toFixed(1)}% vs 30d avg</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Order Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <p className="text-2xl font-bold">${analytics.avgOrderValue.toFixed(2)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per completed order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-600" />
              <p className="text-2xl font-bold">{analytics.avgRating.toFixed(1)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalReviews} {analytics.totalReviews === 1 ? 'review' : 'reviews'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Listings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              <p className="text-2xl font-bold">{analytics.activeListings}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalListings} total listings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversion Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold">{analytics.conversionRate.toFixed(1)}%</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Orders per active listing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>30-Day Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <p className="text-2xl font-bold">${analytics.revenueLast30Days.toFixed(2)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
          <CardDescription>Key metrics overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Revenue (7d)</p>
              <p className="text-lg font-semibold">${analytics.revenueLast7Days.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Orders (7d)</p>
              <p className="text-lg font-semibold">{analytics.ordersLast7DaysCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue (30d)</p>
              <p className="text-lg font-semibold">${analytics.revenueLast30Days.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Orders (30d)</p>
              <p className="text-lg font-semibold">{analytics.ordersLast30DaysCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

