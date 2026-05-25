'use client'

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Pin, Trophy } from "lucide-react";
import { useInfiniteListings, useSearchListings } from "@/hooks/useInfiniteListings";
import { ListingCard } from "@/components/ListingCard";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { PostCard } from "@/components/PostCard";
import { useFeed } from "@/hooks/useFeed";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNews, searchProfiles, getListings } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { VerifiedVendorBadge } from "@/components/VerifiedVendorBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

export default function Explore() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [newsPage, setNewsPage] = useState(0);

  // Real-time subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel("posts:explore")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["feed"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Marketplace queries
  const {
    data: listingsData,
    fetchNextPage: fetchNextListings,
    hasNextPage: hasMoreListings,
    isLoading: listingsLoading,
  } = useInfiniteListings(selectedCategory === "all" ? undefined : selectedCategory);

  const {
    data: searchListingsData,
    fetchNextPage: fetchNextSearchListings,
    hasNextPage: hasMoreSearchListings,
    isLoading: searchListingsLoading,
  } = useSearchListings(searchQuery);

  // Posts feed
  const {
    data: postsData,
    fetchNextPage: fetchNextPosts,
    hasNextPage: hasMorePosts,
    isLoading: postsLoading,
  } = useFeed();

  // News queries
  const { data: newsData, isLoading: newsLoading, refetch: refetchNews } = useQuery({
    queryKey: ["news", newsPage],
    queryFn: () => getNews(newsPage, 10),
  });

  // Vendor search
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ["searchVendors", searchQuery],
    queryFn: () => searchProfiles(searchQuery),
    enabled: activeTab === "vendors" && searchQuery.length > 0,
  });

  const listings = searchQuery
    ? searchListingsData?.pages.flatMap((page) => page) || []
    : listingsData?.pages.flatMap((page) => page) || [];

  const posts = postsData?.pages.flatMap((page) => page) || [];
  const news = newsData || [];
  const vendors = vendorsData?.filter((v) => v.is_vendor) || [];

  const handleAddToCart = async (listingId: string) => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to log in to add items to cart",
        variant: "destructive",
      });
      return;
    }
    await addItem(listingId, 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Explore
        </h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="grid w-full min-w-max grid-cols-5 gap-1 sm:gap-2">
              <TabsTrigger value="all" className="text-xs sm:text-sm whitespace-nowrap">All</TabsTrigger>
              <TabsTrigger value="posts" className="text-xs sm:text-sm whitespace-nowrap">Posts</TabsTrigger>
              <TabsTrigger value="marketplace" className="text-xs sm:text-sm whitespace-nowrap">Products</TabsTrigger>
              <TabsTrigger value="vendors" className="text-xs sm:text-sm whitespace-nowrap">Vendors</TabsTrigger>
              <TabsTrigger value="news" className="text-xs sm:text-sm whitespace-nowrap">News</TabsTrigger>
            </TabsList>
          </div>

          {/* All Tab - Shows everything */}
          <TabsContent value="all" className="space-y-6">
            {/* Recent Posts */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Recent Posts</h2>
              {postsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No posts available</div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-6">
                  {posts.slice(0, 3).map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={user?.id} />
                  ))}
                </div>
              )}
            </div>

            {/* Trending Products */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Trending Products</h2>
              {listingsLoading || searchListingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No listings available</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {listings.slice(0, 6).map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      currentUserId={user?.id}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Latest News */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Latest News</h2>
              {newsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : news.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No news available</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {news.slice(0, 4).map((item) => (
                    <Card key={item.id} className="hover:shadow-lg transition-shadow">
                      {item.image_url && (
                        <img 
                          src={item.image_url} 
                          alt={item.title} 
                          className="w-full h-48 object-cover rounded-t-lg"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          {item.is_pinned && <Pin className="h-4 w-4 text-primary flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.created_at || ""), { addSuffix: true })}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.excerpt || item.content.substring(0, 150)}...
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="marketplace" className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {!searchQuery && (
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                    <SelectItem value="Clothing">Clothing</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Services">Services</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Listings Grid */}
            {listingsLoading || searchListingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "No listings found" : "No listings available"}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {listings.map((listing) => (
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
                      Load More Listings
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="posts" className="space-y-6">
            {postsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No posts available
              </div>
            ) : (
              <>
                <div className="max-w-2xl mx-auto space-y-6">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={user?.id} />
                  ))}
                </div>

                {hasMorePosts && (
                  <div className="flex justify-center pt-6">
                    <Button onClick={() => fetchNextPosts()} variant="outline">
                      Load More Posts
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Vendors Tab */}
          <TabsContent value="vendors" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {vendorsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "No vendors found" : "Search for vendors above"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendors.map((vendor) => (
                  <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={vendor.avatar_url} />
                          <AvatarFallback>{vendor.username?.[0]?.toUpperCase() || "V"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{vendor.display_name || vendor.username}</CardTitle>
                          <CardDescription className="truncate">@{vendor.username}</CardDescription>
                          {vendor.vendor_verified && (
                            <div className="mt-1">
                              <VerifiedVendorBadge size="sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {vendor.bio && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{vendor.bio}</p>}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-primary" />
                          <span>{vendor.points || 0} pts</span>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/store/${vendor.id}`}>View Store</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news" className="space-y-6">
            {newsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : news.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No news available</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {news.map((item) => (
                    <Card key={item.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                      {item.image_url && (
                        <img 
                          src={item.image_url} 
                          alt={item.title} 
                          className="w-full h-48 object-cover rounded-t-lg"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          {item.is_pinned && <Pin className="h-4 w-4 text-primary flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.created_at || ""), { addSuffix: true })}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {item.excerpt || item.content.substring(0, 200)}...
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.view_count || 0} views</span>
                          <Button variant="ghost" size="sm">
                            Read More
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-center pt-6">
                  <Button
                    onClick={() => {
                      setNewsPage((prev) => prev + 1);
                      refetchNews();
                    }}
                    variant="outline"
                  >
                    Load More News
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
