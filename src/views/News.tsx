'use client'

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Calendar, Eye, Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getNews, getNewsItem } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { OptimizedImage } from "@/components/OptimizedImage";
import { SkeletonCard } from "@/components/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { News } from "@/lib/types";
import { AdsWidget } from "@/components/feed/widgets/AdsWidget";
import { PageShell } from "@/components/PageShell";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

interface NewsProps {
  newsId?: string;
}

export default function News({ newsId }: NewsProps) {
  const router = useRouter();
  // Use newsId prop if provided, otherwise try to get from URL (for backward compatibility)
  const id = newsId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : undefined);
  const { user } = useAuth();
  const [page, setPage] = useState(0);

  // Fetch single news item if ID is provided
  const { data: newsItem, isLoading: itemLoading, error: newsError } = useQuery({
    queryKey: ["news", id],
    queryFn: () => getNewsItem(id!),
    enabled: !!id,
    retry: false, // Don't retry if news item doesn't exist
  });

  // Fetch news list if no ID
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ["news", page],
    queryFn: () => getNews(page, 12),
    enabled: !id,
  });

  const isLoading = id ? itemLoading : newsLoading;

  useRealtimeInvalidate('news:page', 'news', [['news']], { enabled: !id });

  // Single news item view
  if (id) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-background">
          <Navigation />
          <PageShell narrow>
            <div className="space-y-6">
              <SkeletonCard />
            </div>
          </PageShell>
        </div>
      );
    }

    if (!newsItem || newsError) {
      return (
        <div className="min-h-screen bg-background">
          <Navigation />
          <PageShell narrow>
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold mb-4">News Article Not Found</h1>
              <p className="text-muted-foreground mb-6">
                The news article you're looking for doesn't exist or has been removed.
              </p>
              <Button onClick={() => router.push("/news")}>Back to News</Button>
            </div>
          </PageShell>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <PageShell narrow>
            <Button
              variant="ghost"
              onClick={() => router.push("/news")}
              className="mb-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to News
            </Button>

            <Card>
              {newsItem.image_url && (
                <div className="relative h-96 w-full overflow-hidden rounded-t-lg">
                  <OptimizedImage
                    src={newsItem.image_url}
                    alt={newsItem.title}
                    className="object-cover w-full h-full"
                  />
                  {newsItem.is_pinned && (
                    <Badge className="absolute top-4 right-4">Pinned</Badge>
                  )}
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {newsItem.created_at && format(new Date(newsItem.created_at), "MMMM d, yyyy")}
                  </div>
                  {newsItem.view_count !== undefined && (
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {newsItem.view_count} views
                    </div>
                  )}
                </div>
                <CardTitle className="text-3xl md:text-4xl">{newsItem.title}</CardTitle>
                {(newsItem.excerpt || newsItem.summary) && (
                  <CardDescription className="text-lg">
                    {newsItem.excerpt || newsItem.summary}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="prose prose-lg max-w-none">
                  <div className="whitespace-pre-wrap text-foreground">
                    {newsItem.content}
                  </div>
                </div>
              </CardContent>
            </Card>
        </PageShell>
      </div>
    );
  }

  // News list view
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
              News & Updates
            </h1>
            <p className="text-muted-foreground">
              Stay informed with the latest news and updates from Optimix
            </p>
          </div>

          <AdsWidget placement="news" className="mb-8" />

          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : newsData && newsData.length > 0 ? (
            <>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {newsData.map((news) => (
                  <Link key={news.id} href={`/news/${news.id}`}>
                    <Card className="h-full hover:shadow-hover transition-all cursor-pointer border-2">
                      {news.image_url && (
                        <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                          <OptimizedImage
                            src={news.image_url}
                            alt={news.title}
                            className="object-cover w-full h-full"
                          />
                          {news.is_pinned && (
                            <Badge className="absolute top-2 right-2">Pinned</Badge>
                          )}
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="line-clamp-2">{news.title}</CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3 w-3" />
                            {news.created_at && formatDistanceToNow(new Date(news.created_at), { addSuffix: true })}
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {news.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                            {news.excerpt}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {news.content}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                {page > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                )}
                {newsData.length === 12 && (
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Card className="border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Newspaper className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No News Available</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Check back later for the latest news and updates.
                </p>
                {!user && (
                  <Button onClick={() => router.push("/auth")}>
                    Sign Up to Stay Updated
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
      </PageShell>
    </div>
  );
}

