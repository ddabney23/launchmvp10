'use client'

import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Star, Package } from "lucide-react";
import { useInfiniteListings, useSearchListings } from "@/hooks/useInfiniteListings";
import { ListingCard } from "@/components/ListingCard";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { searchProfiles } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { SkeletonListing } from "@/components/Skeleton";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { SearchFilters, SearchFiltersType } from "@/components/SearchFilters";
import { AdsWidget } from "@/components/feed/widgets/AdsWidget";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export default function Marketplace() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<SearchFiltersType>({
    category: undefined,
    sortBy: 'newest',
    priceMin: 0,
    priceMax: 10000,
  });

  const {
    data: listingsData,
    fetchNextPage: fetchNextListings,
    hasNextPage: hasMoreListings,
    isLoading: listingsLoading,
  } = useInfiniteListings(filters.category);

  const {
    data: searchListingsData,
    fetchNextPage: fetchNextSearchListings,
    hasNextPage: hasMoreSearchListings,
    isLoading: searchListingsLoading,
  } = useSearchListings(searchQuery);

  useRealtimeInvalidate('listings:marketplace', 'listings', [['listings'], ['recommendedListings']]);

  // Get featured vendors
  const { data: featuredVendors } = useQuery({
    queryKey: ["featuredVendors"],
    queryFn: () => searchProfiles(""),
    enabled: !!user,
  });

  // Get vendor stats for featured vendors
  const vendors = featuredVendors?.filter((v) => v.is_vendor && v.vendor_verified).slice(0, 6) || [];
  
  // Fetch stats for each vendor
  const { data: vendorStatsMap } = useQuery({
    queryKey: ["vendorStats", vendors.map(v => v.id).join(",")],
    queryFn: async () => {
      const statsMap: Record<string, { products: number; sales: number; rating: number }> = {};
      
      await Promise.all(
        vendors.map(async (vendor) => {
          try {
            // Get product count
            const { count: productsCount } = await supabase
              .from("listings")
              .select("*", { count: "exact", head: true })
              .eq("vendor", vendor.id)
              .eq("active", true);

            // Get sales count
            const { count: salesCount } = await supabase
              .from("orders")
              .select("*", { count: "exact", head: true })
              .eq("vendor", vendor.id)
              .in("status", ["paid", "completed"]);

            // Get average rating
            const { data: reviews } = await supabase
              .from("reviews")
              .select("rating")
              .eq("vendor_id", vendor.id);

            const avgRating = reviews && reviews.length > 0
              ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
              : 0;

            statsMap[vendor.id] = {
              products: productsCount || 0,
              sales: salesCount || 0,
              rating: avgRating,
            };
          } catch (error) {
            console.error(`Error fetching stats for vendor ${vendor.id}:`, error);
            statsMap[vendor.id] = { products: 0, sales: 0, rating: 0 };
          }
        })
      );

      return statsMap;
    },
    enabled: vendors.length > 0,
  });

  const listings = searchQuery
    ? searchListingsData?.pages.flatMap((page) => page) || []
    : listingsData?.pages.flatMap((page) => page) || [];

  // Filter and sort listings
  const filteredAndSortedListings = [...listings]
    .filter(listing => {
      // Apply price filter
      if (filters.priceMin !== undefined && listing.price < filters.priceMin) return false
      if (filters.priceMax !== undefined && listing.price > filters.priceMax) return false
      // Apply listing type filter
      if (filters.listingType && listing.listing_type !== filters.listingType) return false
      return true
    })
    .sort((a, b) => {
      switch (filters.sortBy) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "newest":
          return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime();
        case "popular":
          // Sort by views or likes if available
          return 0;
        default:
          return 0;
      }
    });

  // Get top products (can be enhanced with actual popularity metrics)
  const topProducts = filteredAndSortedListings.slice(0, 6);
  
  // Available categories
  const categories = Array.from(new Set(listings.map(l => l.category).filter(Boolean))) as string[];

  const handleAddToCart = (listingId: string) => {
    const listing = listings.find((l) => l.id === listingId);
    if (listing) {
      addItem({
        listing_id: listing.id,
        quantity: 1,
        listing,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
            Marketplace
          </h1>
          <p className="text-muted-foreground">Discover and shop from verified vendors</p>
        </div>

        {/* Featured Vendors Section */}
        {vendors.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Featured Vendors
              </CardTitle>
              <CardDescription>Top verified vendors on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {vendors.map((vendor) => {
                  const stats = vendorStatsMap?.[vendor.id];
                  return (
                    <Link
                      key={vendor.id}
                      href={`/store/${vendor.id}`}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-muted transition-colors border border-border"
                    >
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={vendor.avatar_url || undefined} />
                        <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-primary-foreground font-bold text-xl">
                          {vendor.username?.[0]?.toUpperCase() || "V"}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium text-center truncate w-full">{vendor.display_name || vendor.username}</p>
                      {vendor.vendor_verified && (
                        <Badge variant="default" className="text-xs">Verified</Badge>
                      )}
                      {stats && (
                        <div className="flex flex-col gap-1 mt-1 text-xs text-muted-foreground w-full">
                          <div className="flex items-center justify-center gap-1">
                            <Package className="h-3 w-3" />
                            <span>{stats.products} products</span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>{stats.sales} sales</span>
                          </div>
                          {stats.rating > 0 && (
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              <span>{stats.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Products Section */}
        {topProducts.length > 0 && !searchQuery && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Top Products
              </CardTitle>
              <CardDescription>Popular items this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topProducts.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    currentUserId={user?.id}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <AdsWidget placement="marketplace" className="mb-8" />

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <SearchAutocomplete
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search products, vendors, or posts..."
                className="flex-1"
              />
              {!searchQuery && (
                <SearchFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  categories={categories}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {listingsLoading || searchListingsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <SkeletonListing key={i} />
            ))}
          </div>
        ) : filteredAndSortedListings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground text-center">
                {searchQuery 
                  ? "Try adjusting your search terms" 
                  : "No products available at the moment"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  currentUserId={user?.id}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>

            {(hasMoreListings || hasMoreSearchListings) && (
              <div className="flex justify-center pt-6">
                <Button
                  onClick={() => {
                    if (searchQuery) {
                      fetchNextSearchListings();
                    } else {
                      fetchNextListings();
                    }
                  }}
                  variant="outline"
                >
                  Load More Products
                </Button>
              </div>
            )}
          </>
        )}
      </PageShell>
    </div>
  );
}

