'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Plus, Users, Search, ArrowRight, Crown, Shield, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGroups, createGroup, joinGroup, leaveGroup, getUserGroups, getGroupPosts, getGroup, getGroupLeaderboard } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PostCard } from "@/components/PostCard";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GroupCreateSchema } from "@/lib/validators";
import type { GroupCreate } from "@/lib/types";

interface GroupsProps {
  groupId?: string;
}

export default function Groups({ groupId }: GroupsProps) {
  const { user } = useAuth();
  const router = useRouter();
  // Use groupId prop if provided, otherwise try to get from URL (for backward compatibility)
  const id = groupId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : undefined);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(id || null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "leaderboard">("feed");

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => getGroups(0, 50),
  });

  const { data: userGroupsData } = useQuery({
    queryKey: ["userGroups", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getUserGroups(user.id);
    },
    enabled: !!user?.id,
  });

  const { data: groupData } = useQuery({
    queryKey: ["group", selectedGroup],
    queryFn: () => {
      if (!selectedGroup) {
        throw new Error('No group selected');
      }
      return getGroup(selectedGroup);
    },
    enabled: !!selectedGroup,
  });

  const { data: groupPostsData, isLoading: postsLoading } = useQuery({
    queryKey: ["groupPosts", selectedGroup],
    queryFn: () => {
      if (!selectedGroup) {
        throw new Error('No group selected');
      }
      return getGroupPosts(selectedGroup);
    },
    enabled: !!selectedGroup,
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["groupLeaderboard", selectedGroup],
    queryFn: () => {
      if (!selectedGroup) {
        throw new Error('No group selected');
      }
      return getGroupLeaderboard(selectedGroup, 50);
    },
    enabled: !!selectedGroup,
  });

  const createGroupForm = useForm<GroupCreate>({
    resolver: zodResolver(GroupCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      slug: "",
      is_public: true,
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["userGroups", user?.id] });
      toast({ title: "Group created successfully!" });
      setCreateDialogOpen(false);
      createGroupForm.reset();
      router.push(`/groups/${data.id}`);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create group'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: joinGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["userGroups", user?.id] });
      toast({ title: "Joined group successfully!" });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join group'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: leaveGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["userGroups", user?.id] });
      toast({ title: "Left group successfully!" });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave group'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const userGroupIds = new Set(userGroups.map((g) => g.id));
  const filteredGroups = searchQuery
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : groups;

  const handleCreateGroup = (data: GroupCreate) => {
    // Generate slug from name
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    createGroupMutation.mutate({ ...data, slug });
  };

  const handleJoinGroup = (groupId: string) => {
    if (!user) {
      toast({ title: "Please log in to join groups", variant: "destructive" });
      return;
    }
    joinGroupMutation.mutate(groupId);
  };

  const handleLeaveGroup = (groupId: string) => {
    leaveGroupMutation.mutate(groupId);
  };

  useEffect(() => {
    if (id) {
      setSelectedGroup(id);
    }
  }, [id]);

  const groups = groupsData || [];
  const userGroups = userGroupsData || [];

  // If viewing a specific group, show detail view
  if (selectedGroup && groupData) {
    const isMember = userGroups.some((g) => g.id === selectedGroup);
    const posts = groupPostsData || [];
    const leaderboard = leaderboardData || [];

    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedGroup(null);
                router.push("/groups");
              }}
              className="mb-4"
            >
              <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              Back to Groups
            </Button>

            {/* Group Header */}
            <Card className="mb-6">
              <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg">
                {groupData.cover_image_url && (
                  <img
                    src={groupData.cover_image_url}
                    alt={groupData.name}
                    className="w-full h-full object-cover rounded-t-lg"
                  />
                )}
              </div>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-2xl">{groupData.name}</CardTitle>
                      {!groupData.is_public && <Badge variant="outline">Private</Badge>}
                    </div>
                    <CardDescription>{groupData.description}</CardDescription>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{groupData.member_count || 0} members</span>
                      </div>
                    </div>
                  </div>
                  {user && (
                    <Button
                      variant={isMember ? "outline" : "default"}
                      onClick={() => {
                        if (isMember) {
                          handleLeaveGroup(selectedGroup);
                        } else {
                          handleJoinGroup(selectedGroup);
                        }
                      }}
                      disabled={joinGroupMutation.isPending || leaveGroupMutation.isPending}
                    >
                      {isMember ? "Leave Group" : "Join Group"}
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "feed" | "leaderboard")} className="space-y-4">
              <TabsList>
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="leaderboard">
                  <Trophy className="h-4 w-4 mr-2" />
                  Leaderboard
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="space-y-4">
                {postsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : posts.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <p className="text-muted-foreground mb-4">No posts in this group yet</p>
                      {isMember && (
                        <Button asChild>
                          <Link href="/create">Create Post</Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} currentUserId={user?.id} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="leaderboard" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      Group Leaderboard
                    </CardTitle>
                    <CardDescription>Top contributors in this group</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {leaderboardLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No leaderboard data yet. Start engaging to earn points!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leaderboard.map((entry, index) => (
                          <div
                            key={entry.user_id}
                            className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 font-bold text-lg">
                              {index === 0 ? (
                                <Crown className="h-5 w-5 text-yellow-500" />
                              ) : index === 1 ? (
                                <Trophy className="h-5 w-5 text-gray-400" />
                              ) : index === 2 ? (
                                <Trophy className="h-5 w-5 text-orange-400" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={entry.profile?.avatar_url} />
                              <AvatarFallback>
                                {entry.profile?.username?.[0]?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {entry.profile?.display_name || entry.profile?.username || "Unknown"}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                @{entry.profile?.username || "unknown"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">{entry.points}</p>
                              <p className="text-xs text-muted-foreground">points</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Groups
            </h1>
            <p className="text-muted-foreground">Join communities and connect with like-minded people</p>
          </div>
          {user && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                  <DialogDescription>Create a community for people to join and share</DialogDescription>
                </DialogHeader>
                <form onSubmit={createGroupForm.handleSubmit(handleCreateGroup)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Group Name *</Label>
                    <Input
                      id="name"
                      {...createGroupForm.register("name")}
                      placeholder="e.g., Local Foodies"
                    />
                    {createGroupForm.formState.errors.name && (
                      <p className="text-sm text-destructive">{createGroupForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...createGroupForm.register("description")}
                      placeholder="Tell people what this group is about..."
                      rows={4}
                    />
                  </div>
                  <Button type="submit" disabled={createGroupMutation.isPending} className="w-full">
                    {createGroupMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Group"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* My Groups */}
        {user && userGroups.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>My Groups</CardTitle>
              <CardDescription>Groups you're a member of</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userGroups.map((group) => (
                  <Card key={group.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{group.name}</CardTitle>
                          <CardDescription className="line-clamp-2">{group.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{group.member_count || 0} members</span>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/groups/${group.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Groups */}
        <Card>
          <CardHeader>
            <CardTitle>All Groups</CardTitle>
            <CardDescription>Discover and join communities</CardDescription>
          </CardHeader>
          <CardContent>
            {groupsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "No groups found" : "No groups available yet"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map((group) => {
                  const isMember = userGroupIds.has(group.id);
                  return (
                    <Card key={group.id} className="hover:shadow-lg transition-shadow">
                      {group.cover_image_url && (
                        <img
                          src={group.cover_image_url}
                          alt={group.name}
                          className="w-full h-32 object-cover rounded-t-lg"
                        />
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{group.name}</CardTitle>
                              {!group.is_public && <Badge variant="outline">Private</Badge>}
                            </div>
                            <CardDescription className="line-clamp-2 mt-2">{group.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{group.member_count || 0} members</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant={isMember ? "outline" : "default"}
                            className="flex-1"
                            onClick={() => {
                              if (isMember) {
                                handleLeaveGroup(group.id);
                              } else {
                                handleJoinGroup(group.id);
                              }
                            }}
                            disabled={joinGroupMutation.isPending || leaveGroupMutation.isPending}
                          >
                            {isMember ? "Leave" : "Join"}
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/groups/${group.id}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

