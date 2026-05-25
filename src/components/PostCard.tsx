'use client'

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Heart, MessageCircle, MoreVertical, Trash2, Send, Edit, Globe, Users, Lock, Share2, Bookmark, Repeat2, Eye, BarChart3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { like, unlike, isLiked, getLikeCount, getPostComments, deletePost, createComment, deleteComment, searchProfiles, getProfile } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import type { Post, Profile, Comment, CommentCreate } from "@/lib/types";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { useAuth } from "@/hooks/useAuth";
import { extractMentionUsernames } from "@/lib/mentions";

interface PostCardProps {
  post: Post;
  currentUserId?: string;
}

export const PostCard = ({ post, currentUserId }: PostCardProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: authUser, isAuthenticated: isSignedIn } = useAuth();
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editVisibility, setEditVisibility] = useState<"public" | "followers" | "private">(post.visibility || "followers");
  const [isSaved, setIsSaved] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(post.view_count || 0);
  const [shareCount, setShareCount] = useState(post.share_count || 0);
  const lastTapRef = useRef<number>(0);
  const [commentMentionQuery, setCommentMentionQuery] = useState("");
  const [commentMentionSuggestions, setCommentMentionSuggestions] = useState<Profile[]>([]);
  const [isCommentMentionLoading, setIsCommentMentionLoading] = useState(false);
  const [commentCaretPosition, setCommentCaretPosition] = useState(0);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const commentMentionCacheRef = useRef<Record<string, Profile>>({});

  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile", post.author],
    queryFn: () => getProfile(post.author),
    enabled: !!post.author,
  });

  const { data: comments, refetch: refetchComments } = useQuery<Comment[]>({
    queryKey: ["comments", post.id],
    queryFn: () => getPostComments(post.id),
    enabled: showComments,
  });

  // Fetch comment author profiles
  const commentProfiles = useQuery({
    queryKey: ["commentProfiles", comments?.map(c => c.author)],
    queryFn: async () => {
      if (!comments) return {};
      const profiles: Record<string, Profile> = {};
      await Promise.all(
        comments.map(async (comment) => {
          try {
            const profileData = await getProfile(comment.author);
            profiles[comment.author] = profileData;
          } catch (error) {
            // Ignore errors for missing profiles
          }
        })
      );
      return profiles;
    },
    enabled: !!comments && comments.length > 0,
  });

  useEffect(() => {
    if (!commentMentionQuery || commentMentionQuery.length < 2) {
      setCommentMentionSuggestions([]);
      setIsCommentMentionLoading(false);
      return;
    }

    setIsCommentMentionLoading(true);
    const handler = setTimeout(async () => {
      try {
        const results = await searchProfiles(commentMentionQuery);
        setCommentMentionSuggestions(results.slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch mention suggestions", error);
      } finally {
        setIsCommentMentionLoading(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [commentMentionQuery]);

  const { data: isLikedData } = useQuery({
    queryKey: ["isLiked", "post", post.id, currentUserId],
    queryFn: () => {
      if (!currentUserId) return false;
      return isLiked("post", post.id);
    },
    enabled: !!currentUserId,
    onSuccess: (data) => setLocalIsLiked(data),
  });

  const { data: likesCountData } = useQuery({
    queryKey: ["likeCount", "post", post.id],
    queryFn: () => getLikeCount("post", post.id),
    onSuccess: (data) => setLocalLikesCount(data),
  });

  useEffect(() => {
    if (isLikedData !== undefined) setLocalIsLiked(isLikedData);
  }, [isLikedData]);

  useEffect(() => {
    if (likesCountData !== undefined) setLocalLikesCount(likesCountData);
  }, [likesCountData]);

  const likeMutation = useMutation({
    mutationFn: () => like("post", post.id),
    onMutate: async () => {
      setLocalIsLiked(true);
      setLocalLikesCount((prev) => prev + 1);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["isLiked", "post", post.id, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["likeCount", "post", post.id] });
    },
    onError: () => {
      setLocalIsLiked(false);
      setLocalLikesCount((prev) => Math.max(0, prev - 1));
      toast({
        title: "Error",
        description: "Failed to like post",
        variant: "destructive",
      });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => unlike("post", post.id),
    onMutate: async () => {
      setLocalIsLiked(false);
      setLocalLikesCount((prev) => Math.max(0, prev - 1));
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["isLiked", "post", post.id, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["likeCount", "post", post.id] });
    },
    onError: () => {
      setLocalIsLiked(true);
      setLocalLikesCount((prev) => prev + 1);
      toast({
        title: "Error",
        description: "Failed to unlike post",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast({ title: "Post deleted" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          visibility: editVisibility,
        }),
      });
      if (!response.ok) throw new Error('Failed to update post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      setIsEditDialogOpen(false);
      toast({ title: "Post updated! ✨" });
    },
    onError: () => {
      toast({ title: "Failed to update post", variant: "destructive" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: (data: CommentCreate) => createComment(data),
    onSuccess: () => {
      setCommentText("");
      setCommentMentionQuery("");
      setCommentMentionSuggestions([]);
      // Invalidate and refetch comments
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      refetchComments();
      // Award points notification (handled by API)
      toast({
        title: "Comment posted! 💬",
        description: "You earned 2 points!",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    },
  });

  const handleLike = () => {
    if (!currentUserId) {
      toast({ title: "Please log in to like posts", variant: "destructive" });
      return;
    }

    if (localIsLiked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this post?")) {
      deleteMutation.mutate();
    }
  };

  const handleEdit = () => {
    setEditContent(post.content || "");
    setEditVisibility(post.visibility || "followers");
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    updatePostMutation.mutate();
  };

  const handleShare = async () => {
    // Increment share count
    try {
      await fetch('/api/posts/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include session cookies for authenticated API routes
        body: JSON.stringify({ postId: post.id }),
      });
      setShareCount(prev => prev + 1);
    } catch (err) {
      // Continue anyway
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${profile?.display_name || profile?.username}`,
          text: post.content || '',
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied to clipboard!" });
    }
  };

  const handleBookmark = () => {
    setIsSaved(!isSaved);
    toast({ title: isSaved ? "Removed from saved" : "Saved to bookmarks 🔖" });
  };

  const visibilityIcons = {
    public: <Globe className="h-3 w-3" />,
    followers: <Users className="h-3 w-3" />,
    private: <Lock className="h-3 w-3" />,
  };

  const visibilityLabels = {
    public: "Everyone",
    followers: "Followers only",
    private: "Only me",
  };

  const renderContentWithMentions = (text: string, keyPrefix: string): ReactNode => {
    if (!text) return null;

    const nodes: ReactNode[] = [];
    const mentionRegex = /@([a-zA-Z0-9_]{2,30})/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }

      const username = match[1];
      nodes.push(
        <Link
          key={`${keyPrefix}-${match.index}-${username}`}
          href={`/u/${username.toLowerCase()}`}
          className="text-primary hover:underline"
        >
          @{username}
        </Link>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
  };

  const updateCommentMentionState = (value: string, caret: number) => {
    const textBeforeCaret = value.slice(0, caret);
    const match = textBeforeCaret.match(/@([a-zA-Z0-9_]{1,30})$/);

    if (match) {
      setCommentMentionQuery(match[1]);
    } else {
      setCommentMentionQuery("");
      setCommentMentionSuggestions([]);
    }
  };

  const handleCommentInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    setCommentText(value);
    setCommentCaretPosition(caret);
    updateCommentMentionState(value, caret);
  };

  const handleCommentInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const caret = event.currentTarget.selectionStart ?? 0;
    setCommentCaretPosition(caret);

    if (event.key === "Escape" && commentMentionSuggestions.length > 0) {
      event.preventDefault();
      setCommentMentionQuery("");
      setCommentMentionSuggestions([]);
    }
  };

  const handleCommentMentionSelect = (profile: Profile) => {
    if (!commentInputRef.current || !profile.username) return;

    const mentionStart = commentCaretPosition - commentMentionQuery.length - 1;
    const before = commentText.slice(0, Math.max(0, mentionStart));
    const after = commentText.slice(Math.max(0, commentCaretPosition));
    const insertion = `@${profile.username} `;
    const newValue = `${before}${insertion}${after}`;

    setCommentText(newValue);
    setCommentMentionQuery("");
    setCommentMentionSuggestions([]);

    const newCaret = before.length + insertion.length;
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
      commentInputRef.current?.setSelectionRange(newCaret, newCaret);
      setCommentCaretPosition(newCaret);
    });

    commentMentionCacheRef.current[profile.username.toLowerCase()] = profile;
  };

  const resolveCommentMentionIds = async (text: string) => {
    const usernames = extractMentionUsernames(text);
    if (!usernames.length) return [];

    const resolvedIds: string[] = [];
    for (const username of usernames) {
      const cached = commentMentionCacheRef.current[username];
      if (cached?.id) {
        resolvedIds.push(cached.id);
        continue;
      }

      try {
        const results = await searchProfiles(username);
        const exact = results.find((profile) => profile.username?.toLowerCase() === username);
        if (exact) {
          commentMentionCacheRef.current[username] = exact;
          resolvedIds.push(exact.id);
        }
      } catch (error) {
        console.error('Failed to resolve comment mention', error);
      }
    }

    return Array.from(new Set(resolvedIds));
  };

  const reactions = [
    { emoji: '❤️', name: 'like', label: 'Like' },
    { emoji: '😍', name: 'love', label: 'Love' },
    { emoji: '😂', name: 'laugh', label: 'Haha' },
    { emoji: '😮', name: 'wow', label: 'Wow' },
    { emoji: '😢', name: 'sad', label: 'Sad' },
    { emoji: '😡', name: 'angry', label: 'Angry' },
  ];

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commentText.trim()) {
      toast({ title: "Please enter a comment", variant: "destructive" });
      return;
    }

    if (!isSignedIn || !authUser) {
      toast({ title: "Please sign in to comment", variant: "destructive" });
      router.push('/auth');
      return;
    }

    if (!currentUserId) {
      toast({ title: "Profile not loaded. Please try again.", variant: "destructive" });
      return;
    }

    try {
      const mentionIds = await resolveCommentMentionIds(commentText);
      createCommentMutation.mutate({
        post_id: post.id,
        content: commentText.trim(),
        mentions: mentionIds,
      });
    } catch (error) {
      console.error('Failed to resolve mentions before commenting', error);
      toast({
        title: "Unable to process mentions",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const isOwner = currentUserId === post.author;

  // Record view when post appears
  useEffect(() => {
    const recordView = async () => {
      if (!post.id) return;
      
      try {
        await fetch('/api/posts/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id }),
        });
        setViewCount(prev => prev + 1);
      } catch (err) {
        // Silent fail
      }
    };

    recordView();
  }, [post.id]);

  // Double-tap to like (like Instagram/TikTok)
  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (!localIsLiked) {
        handleReaction('like');
      }
    }
    
    lastTapRef.current = now;
  };

  const handleReaction = async (reactionType: string) => {
    if (!currentUserId) {
      toast({ title: "Please log in to react", variant: "destructive" });
      return;
    }

    setCurrentReaction(reactionType);
    setLocalIsLiked(true);
    setLocalLikesCount(prev => prev + 1);

    try {
      await fetch('/api/posts/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, reaction: reactionType }),
      });
      setShowReactions(false);
    } catch (err) {
      setLocalIsLiked(false);
      setLocalLikesCount(prev => Math.max(0, prev - 1));
      toast({ title: "Failed to react", variant: "destructive" });
    }
  };

  return (
    <Card className="overflow-hidden shadow-card hover:shadow-hover transition-all duration-300 animate-fade-in">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-white">
              {profile?.username?.[0]?.toUpperCase() || profile?.display_name?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm truncate">{profile?.display_name || profile?.username || "Unknown"}</p>
              {profile?.is_verified && (
                <svg className="h-4 w-4 text-primary fill-current" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">@{profile?.username || "user"}</span>
              <span>•</span>
              <span>{post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : ""}</span>
              <span>•</span>
              <div className="flex items-center gap-1" title={visibilityLabels[post.visibility as keyof typeof visibilityLabels]}>
                {visibilityIcons[post.visibility as keyof typeof visibilityIcons]}
                <span className="capitalize">
                  {visibilityLabels[post.visibility as keyof typeof visibilityLabels]}
                </span>
              </div>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Post options">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {isOwner && (
              <>
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete post
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBookmark}>
              <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? 'Unsave' : 'Save'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="relative bg-muted" onDoubleClick={handleDoubleTap}>
          {localIsLiked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-ping">
              <Heart className="h-24 w-24 fill-white text-white opacity-80" />
            </div>
          )}
          {post.media_urls.length === 1 ? (
            <div className="relative aspect-square bg-muted">
              {post.media_urls[0].match(/\.(mp4|webm|ogg)$/i) ? (
                <video src={post.media_urls[0]} controls className="w-full h-full object-cover" />
              ) : (
                <img 
                  src={post.media_urls[0]} 
                  alt={`Post media: ${post.content ? post.content.substring(0, 50) : 'Media content'}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>
          ) : (
            <Carousel className="w-full">
              <CarouselContent>
                {post.media_urls.map((url, index) => (
                  <CarouselItem key={index}>
                    <div className="relative aspect-square bg-muted">
                      {url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video src={url} controls className="w-full h-full object-cover" />
                      ) : (
                        <img 
                          src={url} 
                          alt={`Post media ${index + 1} of ${post.media_urls.length}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {post.media_urls.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          )}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-2">
        {post.content && (
          <p className="text-sm whitespace-pre-wrap">
            <span className="font-semibold">{profile?.username || "User"}</span>{" "}
            {renderContentWithMentions(post.content, post.id)}
          </p>
        )}
      </div>

      {/* Actions - THREADS STYLE (Below Post) */}
      <div className="px-4 py-2 border-t border-b">
        <div className="flex items-center gap-4">
          {/* Like Button */}
          <div className="relative">
            <button
              onClick={handleLike}
              onMouseEnter={() => setShowReactions(true)}
              onMouseLeave={() => setShowReactions(false)}
              disabled={likeMutation.isPending || unlikeMutation.isPending}
              className={`flex items-center gap-2 ${localIsLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'} transition-colors`}
            >
              <Heart className={`h-5 w-5 ${localIsLiked ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{localLikesCount}</span>
            </button>
            
            {/* Reaction Picker (like Facebook) */}
            {showReactions && (
              <div 
                className="absolute bottom-full left-0 mb-2 flex gap-1 bg-background border rounded-full shadow-lg p-2 animate-in fade-in slide-in-from-bottom-2 z-20"
                onMouseEnter={() => setShowReactions(true)}
                onMouseLeave={() => setShowReactions(false)}
              >
                {reactions.map((reaction) => (
                  <button
                    key={reaction.name}
                    onClick={() => handleReaction(reaction.name)}
                    className="hover:scale-125 transition-transform text-2xl p-1"
                    title={reaction.label}
                    aria-label={reaction.label}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Comment Button */}
          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{comments?.length || 0}</span>
          </button>
          
          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 text-gray-600 hover:text-green-500 transition-colors"
          >
            <Share2 className="h-5 w-5" />
            <span className="text-sm font-medium">{shareCount}</span>
          </button>

          {/* Bookmark Button */}
          <button
            onClick={handleBookmark}
            className={`ml-auto ${isSaved ? 'text-yellow-500' : 'text-gray-600 hover:text-yellow-500'} transition-colors`}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats - Below Action Buttons */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{viewCount} {viewCount === 1 ? "view" : "views"}</span>
          {isOwner && (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors hover:underline"
              onClick={() => router.push(`/analytics/post/${post.id}`)}
              title="View analytics"
            >
              <BarChart3 className="h-3 w-3" />
              Analytics
            </button>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="px-4 pb-4">
        {showComments && (
          <div className="border-t pt-3 space-y-3">
            {/* Comment List */}
            {comments && comments.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {comments.map((comment) => {
                  const commentProfile = commentProfiles.data?.[comment.author];
                  return (
                    <div key={comment.id} className="flex gap-2 items-start">
                      <Avatar className="h-6 w-6 mt-1">
                        <AvatarImage src={commentProfile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {commentProfile?.username?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-semibold">{commentProfile?.username || "User"}</span>{" "}
                          <span>{renderContentWithMentions(comment.content, comment.id)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {comment.created_at ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) : ""}
                        </p>
                      </div>
                      {currentUserId === comment.author && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            if (confirm("Delete this comment?")) {
                              deleteCommentMutation.mutate(comment.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
            )}

            {/* Comment Input */}
            {currentUserId ? (
              <>
                <form onSubmit={handleCommentSubmit} className="flex gap-2 mt-3">
                  <Input
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={handleCommentInputChange}
                    className="flex-1"
                    disabled={createCommentMutation.isPending}
                    aria-label="Comment input"
                    onKeyDown={handleCommentInputKeyDown}
                    ref={commentInputRef}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!commentText.trim() || createCommentMutation.isPending}
                    aria-label="Submit comment"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                {commentMentionSuggestions.length > 0 && (
                  <div className="rounded-md border bg-popover shadow p-2 text-xs space-y-1">
                    {isCommentMentionLoading && (
                      <p className="text-muted-foreground px-1">Searching...</p>
                    )}
                    {commentMentionSuggestions.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className="w-full text-left px-2 py-1 rounded hover:bg-muted transition-colors"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleCommentMentionSelect(profile);
                        }}
                      >
                        <span className="font-medium">@{profile.username}</span>
                        {profile.display_name && (
                          <span className="text-muted-foreground ml-1">
                            {profile.display_name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-3">
                Please <Link href="/sign-in" className="text-primary hover:underline">sign in</Link> to comment
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="What's on your mind?"
              className="min-h-32 resize-none"
            />
            <div>
              <label className="text-sm font-medium mb-2 block">Who can see this?</label>
              <Select value={editVisibility} onValueChange={(value: any) => setEditVisibility(value)}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    {visibilityIcons[editVisibility]}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updatePostMutation.isPending}>
              {updatePostMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
