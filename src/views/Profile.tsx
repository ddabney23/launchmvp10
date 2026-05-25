'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerifiedVendorBadge } from "@/components/VerifiedVendorBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Grid, Users, Edit, Trophy, Sparkles, ShoppingBag, Award, Users as UsersIcon, Activity, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile, useUpdateProfile } from "@/hooks/useUserProfile";
import { useUserPosts } from "@/hooks/useFeed";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { followUser, unfollowUser, isFollowing, getFollowers, getFollowing, getUserBadges, getUserGroups, getUserOrders, getUserPointsHistory } from "@/lib/api";
import { getProfile } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ProfileProps {
  userId?: string;
}

export default function Profile({ userId }: ProfileProps) {
  const router = useRouter();
  const { toast } = useToast();
  // Use userId prop if provided, otherwise try to get from URL (for backward compatibility)
  const id = userId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '');
  const { user, profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();
  
  // Edit profile state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { data: profile, isLoading: profileLoading } = useUserProfile(id);
  const { data: posts, isLoading: postsLoading, fetchNextPage, hasNextPage } = useUserPosts(id);

  const { data: isFollowingData } = useQuery({
    queryKey: ["isFollowing", user?.id, id],
    queryFn: () => {
      if (!user?.id || !id || user.id === id) return false;
      return isFollowing(user.id, id);
    },
    enabled: !!user?.id && !!id && user.id !== id,
  });

  const { data: followers } = useQuery({
    queryKey: ["followers", id],
    queryFn: () => {
      if (!id) return [];
      return getFollowers(id);
    },
    enabled: !!id,
  });

  const { data: following } = useQuery({
    queryKey: ["following", id],
    queryFn: () => {
      if (!id) return [];
      return getFollowing(id);
    },
    enabled: !!id,
  });

  // Fetch user badges
  const { data: userBadges } = useQuery({
    queryKey: ["userBadges", id],
    queryFn: () => {
      if (!id) return [];
      return getUserBadges(id);
    },
    enabled: !!id,
  });

  // Fetch user groups
  const { data: userGroups } = useQuery({
    queryKey: ["userGroups", id],
    queryFn: () => {
      if (!id) return [];
      return getUserGroups(id);
    },
    enabled: !!id,
  });

  const allPosts = posts?.pages.flatMap((page) => page) || [];
  const isOwner = user?.id === profile?.id;

  // Real-time subscription for posts by this user
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`posts:profile:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `author=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["posts", "user", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Fetch user orders (purchased products)
  const { data: userOrders } = useQuery({
    queryKey: ["userOrders", id],
    queryFn: () => {
      if (!id) return [];
      return getUserOrders(id);
    },
    enabled: !!id && !!user?.id && id === user.id,
  });

  // Fetch points history
  const { data: pointsHistory } = useQuery({
    queryKey: ["pointsHistory", id],
    queryFn: () => {
      if (!id) return [];
      return getUserPointsHistory(id, 20);
    },
    enabled: !!id && !!user?.id && id === user.id,
  });

  const followMutation = useMutation({
    mutationFn: () => {
      if (!user?.id || !id) throw new Error("Not authenticated");
      // New API route expects just the following ID (profile UUID)
      return followUser({ following: id } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["followers", id] });
      toast({ title: "Following successfully" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to follow user",
        variant: "destructive",
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => {
      if (!user?.id || !id) throw new Error("Not authenticated");
      return unfollowUser(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["followers", id] });
      toast({ title: "Unfollowed successfully" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unfollow user",
        variant: "destructive",
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Profile not found");
      
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername,
          display_name: editDisplayName,
          bio: editBio,
          avatar_url: editAvatarUrl,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
      setIsEditDialogOpen(false);
      toast({ title: "Profile updated successfully! ✨" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update profile",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 10MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please choose an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'avatars');
      formData.append('path', `avatar.${file.name.split('.').pop()}`);

      console.log('Uploading avatar...', { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type 
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();
      console.log('Upload response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.details || 'Upload failed');
      }
      
      // API wraps response in { success: true, data: { url, publicUrl, path } }
      const uploadData = responseData.data || responseData;
      const url = uploadData.url || uploadData.publicUrl;
      if (!url) {
        console.error('Upload response missing URL:', responseData);
        throw new Error('No URL returned from upload');
      }

      setEditAvatarUrl(url);
      toast({ title: "Avatar uploaded! 📸" });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFollowToggle = () => {
    if (!user) {
      toast({ title: "Please log in to follow users", variant: "destructive" });
      router.push("/auth");
      return;
    }

    if (isFollowingData) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  if (profileLoading || postsLoading) {
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
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Profile not found</p>
          </div>
        </div>
      </div>
    );
  }

  const badges = userBadges || [];
  const groups = userGroups || [];
  const orders = userOrders || [];
  const activity = pointsHistory || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
        <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <Card className="p-8 mb-8 shadow-card animate-fade-in">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              <Avatar className="h-32 w-32 ring-4 ring-primary/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-4xl">
                  {profile.username?.[0]?.toUpperCase() || profile.display_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{profile.display_name || profile.username}</h1>
                      {profile.vendor_verified && (
                        <VerifiedVendorBadge size="sm" className="flex-shrink-0" />
                      )}
                      {profile.is_vendor && !profile.vendor_verified && (
                        <Badge variant="outline" className="flex-shrink-0 text-xs sm:text-sm">Vendor</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">@{profile.username}</p>
                  </div>

                  <div className="flex gap-2 justify-center md:justify-end">
                    {isOwner ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditUsername(profile.username || '');
                          setEditDisplayName(profile.display_name || '');
                          setEditBio(profile.bio || '');
                          setEditAvatarUrl(profile.avatar_url || '');
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <Button
                        onClick={handleFollowToggle}
                        variant={isFollowingData ? "outline" : "default"}
                        className={
                          !isFollowingData
                            ? "bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                            : ""
                        }
                        disabled={followMutation.isPending || unfollowMutation.isPending}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        {isFollowingData ? "Unfollow" : "Follow"}
                      </Button>
                    )}
                  </div>
                </div>

                {profile.bio && (
                  <p className="text-foreground">{profile.bio}</p>
                )}

                <div className="flex items-center gap-8 justify-center md:justify-start flex-wrap">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{allPosts.length}</p>
                    <p className="text-sm text-muted-foreground">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{followers?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{following?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Following</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Trophy className="h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-primary">{profile.points || 0}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Points</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="text-2xl">
                        {profile.level === 'Diamond' && '💎'}
                        {profile.level === 'Platinum' && '🏆'}
                        {profile.level === 'Gold' && '🥇'}
                        {profile.level === 'Silver' && '🥈'}
                        {profile.level === 'Bronze' && '🥉'}
                      </span>
                      <p className="text-xl font-bold">{profile.level || 'Bronze'}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Level</p>
                  </div>
                  {profile.credits > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-secondary">{profile.credits}</p>
                      <p className="text-sm text-muted-foreground">Credits</p>
                    </div>
                  )}
                </div>

                {/* Badges Section */}
                {userBadges && userBadges.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Badges</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userBadges.map((userBadge) => (
                        <Badge
                          key={userBadge.id}
                          variant="secondary"
                          className="flex items-center gap-2 px-3 py-1"
                        >
                          <span className="text-lg">{userBadge.icon || "🏅"}</span>
                          <span>{userBadge.name}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className={`grid w-full ${isOwner ? "grid-cols-5" : "grid-cols-3"}`}>
              <TabsTrigger value="posts">
                <Grid className="h-4 w-4 mr-2" />
                Posts
              </TabsTrigger>
              {isOwner && (
                <TabsTrigger value="purchased">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Purchased
                </TabsTrigger>
              )}
              <TabsTrigger value="badges">
                <Award className="h-4 w-4 mr-2" />
                Badges
              </TabsTrigger>
              <TabsTrigger value="groups">
                <UsersIcon className="h-4 w-4 mr-2" />
                Groups
              </TabsTrigger>
              {isOwner && (
                <TabsTrigger value="activity">
                  <Activity className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="posts" className="mt-6">
            {allPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No posts yet
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {allPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>

                {hasNextPage && (
                  <div className="flex justify-center mt-8">
                    <Button
                      onClick={() => fetchNextPage()}
                      variant="outline"
                    >
                      Load More Posts
                    </Button>
                  </div>
                )}
              </>
            )}
            </TabsContent>

            {isOwner && (
              <TabsContent value="purchased" className="mt-6">
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No purchases yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Card key={order.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                            <Badge variant={order.status === "completed" ? "default" : "outline"}>
                              {order.status}
                            </Badge>
                          </div>
                          <CardDescription>
                            {formatDistanceToNow(new Date(order.created_at || ""), { addSuffix: true })}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total: ${order.total}</span>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/order/${order.id}`}>View Details</Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            <TabsContent value="badges" className="mt-6">
              {badges.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No badges earned yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {badges.map((badge) => (
                    <Card key={badge.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Award className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{badge.name}</CardTitle>
                            {badge.awarded_at && (
                              <CardDescription>
                                Earned {formatDistanceToNow(new Date(badge.awarded_at), { addSuffix: true })}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {badge.description && <p className="text-sm text-muted-foreground">{badge.description}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="groups" className="mt-6">
              {groups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Not a member of any groups yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group) => (
                    <Card key={group.id} className="hover:shadow-lg transition-shadow">
                      {group.cover_image_url && (
                        <img
                          src={group.cover_image_url}
                          alt={group.name}
                          className="w-full h-32 object-cover rounded-t-lg"
                        />
                      )}
                      <CardHeader>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{group.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <UsersIcon className="h-4 w-4" />
                            <span>{group.member_count || 0} members</span>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/groups/${group.id}`}>View Group</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {isOwner && (
              <TabsContent value="activity" className="mt-6">
                {activity.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No activity yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activity.map((entry, index) => (
                      <Card key={index}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {entry.reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(entry.awarded_at), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">+{entry.points}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
          </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24">
                <AvatarImage src={editAvatarUrl || profile?.avatar_url} />
                <AvatarFallback>{profile?.display_name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <Label htmlFor="avatar-upload" className="cursor-pointer flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                <Camera className="h-4 w-4" />
                {isUploading ? "Uploading..." : "Change Avatar"}
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={isUploading}
              />
            </div>
            
            {/* Username */}
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                maxLength={30}
              />
              <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and underscores only</p>
            </div>
            
            {/* Display name */}
            <div>
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
              />
            </div>
            
            {/* Bio */}
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell us about yourself"
                rows={4}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">{editBio.length}/200</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending || isUploading}
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
