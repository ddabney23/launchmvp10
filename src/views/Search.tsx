'use client'

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchProfiles, searchListings, searchPosts, getNews } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { ListingCard } from "@/components/ListingCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedVendorBadge } from "@/components/VerifiedVendorBadge";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Post, Listing, Profile, News } from "@/lib/types";
import { SkeletonPostCard, SkeletonListingCard, SkeletonCard, Skeleton } from "@/components/Skeleton";

export default function Search() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(query);
  const [activeTab, setActiveTab] = useState("all");
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();

  // Update search query when URL param changes
  useEffect(() => {
    const urlQuery = searchParams.get("q") || "";
    setSearchQuery(urlQuery);
  }, [searchParams]);

  // Search queries
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["searchPosts", query],
    queryFn: () => searchPosts(query, 0, 20),
    enabled: !!query && (activeTab === "all" || activeTab === "posts"),
  });

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["searchListings", query],
    queryFn: () => searchListings(query, 0, 20),
    enabled: !!query && (activeTab === "all" || activeTab === "marketplace"),
  });

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ["searchVendors", query],
    queryFn: () => searchProfiles(query),
    enabled: !!query && (activeTab === "all" || activeTab === "vendors"),
  });

  const { data: news, isLoading: newsLoading } = useQuery({
    queryKey: ["searchNews", query],
    queryFn: async () => {
      const allNews = await getNews(0, 20);
      return allNews.filter((item: News) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.content.toLowerCase().includes(query.toLowerCase())
      );
    },
    enabled: !!query && (activeTab === "all" || activeTab === "news"),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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

  const filteredVendors = vendors?.filter((v) => v.is_vendor) || [];
  const postsData = posts || [];
  const listingsData = listings || [];
  const newsData = news || [];

  const isLoading =
    (activeTab === "all" || activeTab === "posts") && postsLoading ||
    (activeTab === "all" || activeTab === "marketplace") && listingsLoading ||
    (activeTab === "all" || activeTab === "vendors") && vendorsLoading ||
    (activeTab === "all" || activeTab === "news") && newsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Search
          </h1>

          {/* Search Input */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for posts, products, vendors, news..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit">Search</Button>
            </div>
          </form>

          {!query ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Enter a search query to get started</p>
            </div>
          ) : (
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

              {/* All Tab */}
              <TabsContent value="all" className="space-y-6">
                {isLoading ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-48" />
                      <div className="max-w-2xl mx-auto space-y-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <SkeletonPostCard key={i} />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-48" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <SkeletonListingCard key={i} />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Posts Section */}
                    {postsData.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-2xl font-bold">Posts</h2>
                        <div className="max-w-2xl mx-auto space-y-6">
                          {postsData.slice(0, 3).map((post) => (
                            <PostCard key={post.id} post={post} currentUserId={user?.id} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Products Section */}
                    {listingsData.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-2xl font-bold">Products</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {listingsData.slice(0, 6).map((listing) => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              currentUserId={user?.id}
                              onAddToCart={handleAddToCart}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vendors Section */}
                    {filteredVendors.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-2xl font-bold">Vendors</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredVendors.slice(0, 6).map((vendor) => (
                            <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
                              <CardHeader>
                                <div className="flex items-center gap-4">
                                  <Avatar className="h-16 w-16">
                                    <AvatarImage src={vendor.avatar_url || undefined} />
                                    <AvatarFallback>
                                      {vendor.username?.[0]?.toUpperCase() || "V"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg truncate">
                                      {vendor.display_name || vendor.username}
                                    </CardTitle>
                                    <CardDescription className="truncate">@{vendor.username}</CardDescription>
                                    {vendor.vendor_verified && (
                                      <VerifiedVendorBadge size="sm" className="mt-1" />
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                {vendor.bio && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{vendor.bio}</p>
                                )}
                                <Button variant="outline" size="sm" asChild className="w-full">
                                  <Link href={`/profile/${vendor.id}`}>View Profile</Link>
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* News Section */}
                    {newsData.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-2xl font-bold">News</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {newsData.slice(0, 4).map((item) => (
                            <Card key={item.id} className="hover:shadow-lg transition-shadow">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.title}
                                  className="w-full h-48 object-cover rounded-t-lg"
                                  loading="lazy"
                                />
                              )}
                              <CardHeader>
                                <CardTitle className="text-lg">{item.title}</CardTitle>
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
                      </div>
                    )}

                    {postsData.length === 0 &&
                      listingsData.length === 0 &&
                      filteredVendors.length === 0 &&
                      newsData.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <p>No results found for "{query}"</p>
                        </div>
                      )}
                  </>
                )}
              </TabsContent>

              {/* Posts Tab */}
              <TabsContent value="posts" className="space-y-6">
                {postsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : postsData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No posts found</div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-6">
                    {postsData.map((post) => (
                      <PostCard key={post.id} post={post} currentUserId={user?.id} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Products Tab */}
              <TabsContent value="marketplace" className="space-y-6">
                {listingsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : listingsData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No products found</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listingsData.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        currentUserId={user?.id}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Vendors Tab */}
              <TabsContent value="vendors" className="space-y-6">
                {vendorsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredVendors.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No vendors found</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVendors.map((vendor) => (
                      <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                              <AvatarImage src={vendor.avatar_url} />
                              <AvatarFallback>
                                {vendor.username?.[0]?.toUpperCase() || "V"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg truncate">
                                {vendor.display_name || vendor.username}
                              </CardTitle>
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
                          {vendor.bio && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{vendor.bio}</p>
                          )}
                          <Button variant="outline" size="sm" asChild className="w-full">
                            <Link href={`/store/${vendor.id}`}>View Store</Link>
                          </Button>
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
                ) : newsData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No news found</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {newsData.map((item) => (
                      <Card key={item.id} className="hover:shadow-lg transition-shadow">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-48 object-cover rounded-t-lg"
                            loading="lazy"
                          />
                        )}
                        <CardHeader>
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{item.category}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at || ""), { addSuffix: true })}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {item.excerpt || item.content.substring(0, 200)}...
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}

