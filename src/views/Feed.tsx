'use client'

import { useEffect, useRef, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { PageShell } from "@/components/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "@/components/PostCard";
import { StoriesCarousel } from "@/components/stories/StoriesCarousel";
import { CreateStory } from "@/components/stories/CreateStory";
import { useFeed } from "@/hooks/useFeed";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Newspaper, Plus, Image as ImageIcon, Send, Globe, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonPost } from "@/components/Skeleton";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { createPost, searchProfiles } from "@/lib/api";
import type { Post, Profile } from "@/lib/types";
import { extractMentionUsernames } from "@/lib/mentions";
import { AdsWidget } from "@/components/feed/widgets/AdsWidget";
import { HashtagWidget } from "@/components/feed/widgets/HashtagWidget";
import { FollowSuggestionsWidget } from "@/components/feed/widgets/FollowSuggestionsWidget";
import { PollWidget } from "@/components/feed/widgets/PollWidget";
import { GroupsWidget } from "@/components/feed/widgets/GroupsWidget";

export default function Feed() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [postContent, setPostContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("followers");
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<Profile[]>([]);
  const [isMentionLoading, setIsMentionLoading] = useState(false);
  const [caretPosition, setCaretPosition] = useState(0);
  const postTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionCacheRef = useRef<Record<string, Profile>>({});
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useFeed();

  // Load user's default post visibility preference
  useEffect(() => {
    const loadDefaultVisibility = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_post_visibility')
        .eq('id', user.id)
        .single();
      
      if (profile?.default_post_visibility) {
        setVisibility(profile.default_post_visibility as "public" | "followers" | "private");
      }
    };
    
    loadDefaultVisibility();
  }, [user?.id]);

  const updateMentionQuery = (value: string, caret: number) => {
    const textBeforeCaret = value.slice(0, caret);
    const match = textBeforeCaret.match(/@([a-zA-Z0-9_]{1,30})$/);

    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery("");
      setMentionSuggestions([]);
    }
  };

  useEffect(() => {
    if (!mentionQuery || mentionQuery.length < 2) {
      setMentionSuggestions([]);
      setIsMentionLoading(false);
      return;
    }

    setIsMentionLoading(true);
    const handler = setTimeout(async () => {
      try {
        const results = await searchProfiles(mentionQuery);
        setMentionSuggestions(results.slice(0, 5));
      } catch (error) {
        logger.error("Failed to fetch mention suggestions", error);
      } finally {
        setIsMentionLoading(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [mentionQuery]);

  const handlePostContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    setPostContent(value);
    setCaretPosition(caret);
    updateMentionQuery(value, caret);
  };

  const handlePostContentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const caret = event.currentTarget.selectionStart ?? 0;
    setCaretPosition(caret);

    if (event.key === "Escape" && mentionSuggestions.length > 0) {
      event.preventDefault();
      setMentionQuery("");
      setMentionSuggestions([]);
    }
  };

  const handleMentionSelect = (profile: Profile) => {
    if (!postTextareaRef.current || !profile.username) return;

    const mentionStart = caretPosition - mentionQuery.length - 1;
    const before = postContent.slice(0, Math.max(0, mentionStart));
    const after = postContent.slice(Math.max(0, caretPosition));
    const insertion = `@${profile.username} `;
    const newValue = `${before}${insertion}${after}`;

    setPostContent(newValue);
    setMentionQuery("");
    setMentionSuggestions([]);

    const newCaret = before.length + insertion.length;
    requestAnimationFrame(() => {
      postTextareaRef.current?.focus();
      postTextareaRef.current?.setSelectionRange(newCaret, newCaret);
      setCaretPosition(newCaret);
    });

    mentionCacheRef.current[profile.username.toLowerCase()] = profile;
  };

  const resolveMentionIds = async (text: string) => {
    const usernames = extractMentionUsernames(text);
    if (!usernames.length) return [];

    const resolvedIds: string[] = [];
    for (const username of usernames) {
      const cached = mentionCacheRef.current[username];
      if (cached?.id) {
        resolvedIds.push(cached.id);
        continue;
      }

      try {
        const results = await searchProfiles(username);
        const exact = results.find((profile) => profile.username?.toLowerCase() === username);
        if (exact) {
          mentionCacheRef.current[username] = exact;
          resolvedIds.push(exact.id);
        }
      } catch (error) {
        logger.warn("Failed to resolve mention username", { username, error });
      }
    }

    return Array.from(new Set(resolvedIds));
  };

  // Create post mutation - Threads style inline posting
  const createPostMutation = useMutation({
    mutationFn: createPost,
    onSuccess: (newPost) => {
      // Clear input
      setPostContent("");
      setMentionQuery("");
      setMentionSuggestions([]);
      
      // Invalidate queries to refresh feed
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
      
      // Optimistic update - add post immediately
      queryClient.setQueryData(["feed"], (old: { pages: Post[][] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: [[newPost, ...(old.pages[0] || [])], ...old.pages.slice(1)]
        };
      });
      
      toast({ 
        title: "Post shared! 🎉",
        description: "Your post is now live."
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Couldn't post",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const handlePost = async () => {
    if (!postContent.trim()) {
      toast({
        title: "Post is empty",
        description: "Write something to share",
        variant: "destructive",
      });
      return;
    }

    try {
      const mentionIds = await resolveMentionIds(postContent);
      createPostMutation.mutate({
        content: postContent,
        visibility,
        mentions: mentionIds,
      });
    } catch (error) {
      logger.error("Failed to resolve mentions before posting", error);
      toast({
        title: "Unable to process mentions",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const visibilityIcons = {
    public: <Globe className="h-4 w-4" />,
    followers: <Users className="h-4 w-4" />,
    private: <Lock className="h-4 w-4" />,
  };

  const visibilityLabels = {
    public: "Everyone",
    followers: "Followers only",
    private: "Only me",
  };

  // Real-time subscription for new posts
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const channel = supabase
      .channel(`posts:feed:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        (payload) => {
          if (!isMounted) return; // Prevent updates on unmounted component
          
          // Invalidate queries to refresh feed
          queryClient.invalidateQueries({ queryKey: ["feed"] });
          queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
          
          // Show toast notification for new posts
          toast({
            title: "New post!",
            description: "A new post has been added to your feed.",
          });
        }
      )
      .subscribe((status, err) => {
        if (err) {
          // Only log actual errors, not connection status changes
          logger.warn('Realtime subscription error (non-critical) for feed posts', { 
            status, 
            error: err.message || err
          });
          return;
        }
        
        if (status === 'SUBSCRIBED') {
          logger.debug('Realtime subscribed to feed posts');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // These are connection status changes, not errors - log as debug
          logger.debug('Realtime subscription status changed for feed posts', { status });
        }
      });

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        logger.error('Error removing realtime channel', error);
      }
    };
  }, [user?.id, queryClient, toast]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <PageShell>
          <div className="max-w-2xl mx-auto space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonPost key={i} />
            ))}
          </div>
        </PageShell>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <PageShell>
          <div className="max-w-2xl mx-auto text-center py-12">
            <p className="text-muted-foreground">
              Error loading feed. Please try again later.
            </p>
          </div>
        </PageShell>
      </div>
    );
  }

  const posts = data?.pages.flatMap((page) => page) || [];

  const handleCreateStory = () => {
    setIsCreateStoryOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6">
          <div className="space-y-4">
            {/* Stories Carousel - Above Post Creator */}
            <div className="bg-card rounded-lg border shadow-sm py-4">
              <StoriesCarousel onCreateStory={handleCreateStory} />
            </div>

            {/* Create Story Dialog */}
            <CreateStory open={isCreateStoryOpen} onClose={() => setIsCreateStoryOpen(false)} />

            {/* Threads-Style Inline Post Creator */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex gap-3">
                {/* User Avatar */}
                <div className="shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-white text-sm">
                      {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                {/* Post Input */}
                <div className="flex-1 space-y-3">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={postContent}
                    onChange={handlePostContentChange}
                    className="min-h-20 resize-none border-0 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 p-0 text-base"
                    disabled={createPostMutation.isPending}
                    onKeyDown={(e) => {
                      handlePostContentKeyDown(e);
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handlePost();
                      }
                    }}
                    ref={postTextareaRef}
                  />
                  
                  {mentionSuggestions.length > 0 && (
                    <div className="border rounded-md bg-popover shadow-md p-2 space-y-1 text-sm">
                      {isMentionLoading && (
                        <p className="text-muted-foreground px-1">Searching...</p>
                      )}
                      {mentionSuggestions.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          className="w-full text-left px-2 py-1 rounded hover:bg-muted transition-colors"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleMentionSelect(profile);
                          }}
                        >
                          <span className="font-medium">@{profile.username}</span>
                          {profile.display_name && (
                            <span className="text-muted-foreground text-xs ml-1">
                              {profile.display_name}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => router.push("/create")}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Add media
                      </Button>
                      
                      {/* Visibility Selector */}
                      <Select value={visibility} onValueChange={(value: any) => setVisibility(value)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <div className="flex items-center gap-1.5">
                            {visibilityIcons[visibility]}
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              <span>Everyone</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="followers">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>Followers only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="private">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              <span>Only me</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={handlePost}
                      disabled={!postContent.trim() || createPostMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {createPostMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Post
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            </Card>

            <PollWidget className="lg:hidden" />

            {/* Mobile-only widgets */}
            <div className="space-y-4 lg:hidden">
              <AdsWidget placement="feed" />
              <HashtagWidget />
              <FollowSuggestionsWidget currentUserId={user?.id} />
            </div>

            {posts.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Newspaper className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Be the first to share something!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} currentUserId={user?.id} />
                ))}
                
                {hasNextPage && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      variant="outline"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="hidden lg:flex flex-col gap-4">
            <AdsWidget placement="feed" />
            <HashtagWidget />
            <FollowSuggestionsWidget currentUserId={user?.id} />
            <PollWidget />
            <GroupsWidget userId={user?.id} />
          </aside>
        </div>
      </PageShell>
    </div>
  );
}
