'use client'

import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Users,
  ShoppingBag,
  CheckCircle,
  XCircle,
  TrendingUp,
  Package,
  Shield,
  Award,
  Plus,
  Edit,
  Trash2,
  FileText,
  Sparkles,
  Trophy,
  Search,
  Newspaper,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllUsers,
  getAllVendors,
  updateUserProfile,
  getAllBadges,
  createBadge,
  updateBadge,
  deleteBadge,
  createPublicPost,
  createNews,
  getAllNews,
  updateNews,
  deleteNews,
  uploadFile,
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  getAllAds,
  createAdEntry,
  updateAdEntry,
  deleteAdEntry,
  type Ad,
  type BadgeCreate,
  type NewsCreate,
  type PostCreate,
  type Listing,
  type ListingCreate,
  type ListingUpdate,
} from "@/lib/api";
import { format } from "date-fns";
import type { Profile, News } from "@/lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { useAuditLog } from "@/hooks/useAuditLog";
import { VerifiedVendorBadge } from "@/components/VerifiedVendorBadge";

const BadgeSchema = z.object({
  key: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
});

const NewsSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional().nullable(),
  category: z.enum(["announcement", "update", "feature", "community"]).default("announcement"),
  image_url: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  author: z.string().uuid().optional().nullable(),
  is_pinned: z.boolean().optional(),
  is_published: z.boolean().optional(),
});

const NewsCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  category: z.enum(["announcement", "update", "feature", "community"]).default("announcement"),
  image_url: z.string().optional(),
  is_pinned: z.boolean().optional(),
  is_published: z.boolean().optional(),
});

const PostSchema = z.object({
  content: z.string().min(1),
  media_urls: z.array(z.string()).optional(),
});

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { logEvent } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateBadgeDialogOpen, setIsCreateBadgeDialogOpen] = useState(false);
  const [isCreateNewsDialogOpen, setIsCreateNewsDialogOpen] = useState(false);
  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<string | null>(null);
  const [editingNews, setEditingNews] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = !!profile?.is_admin;

  // CLERK MIGRATION: Fetch vendor applications from API
  const { data: vendorApplicationsData, isLoading: vendorApplicationsLoading, error: vendorApplicationsError } = useQuery({
    queryKey: ["admin", "vendor-applications"],
    queryFn: async () => {
      const response = await fetch('/api/vendor/applications?status=pending', {
        credentials: 'include', // Include cookies for Clerk auth
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch vendor applications' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      // Backend returns: { success: true, data: { applications: [...] } } or { applications: [...] }
      return data.data?.applications || data.applications || [];
    },
    enabled: isAdmin,
    retry: 2,
    retryDelay: 1000,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const [profilesResult, listingsResult, ordersResult, postsResult, vendorsResult, newsResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("listings").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("posts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_vendor", true),
        supabase.from("news").select("id", { count: "exact", head: true }).catch(() => ({ count: 0, error: null })), // Handle if news table doesn't exist
      ]);

      return {
        totalUsers: profilesResult.count || 0,
        totalListings: listingsResult.count || 0,
        totalOrders: ordersResult.count || 0,
        totalPosts: postsResult.count || 0,
        totalVendors: vendorsResult.count || 0,
        totalNews: (newsResult as any).count || 0,
      };
    },
    enabled: isAdmin,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users", searchQuery],
    queryFn: () => getAllUsers(0, 100),
    enabled: isAdmin,
  });

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ["admin", "vendors"],
    queryFn: () => getAllVendors(0, 100),
    enabled: isAdmin,
  });

  const { data: badges, isLoading: badgesLoading } = useQuery({
    queryKey: ["admin", "badges"],
    queryFn: () => getAllBadges(),
    enabled: isAdmin,
  });

  const { data: news, isLoading: newsLoading } = useQuery({
    queryKey: ["admin", "news"],
    queryFn: () => getAllNews(0, 100),
    enabled: isAdmin,
  });

  const badgeForm = useForm<BadgeCreate>({
    resolver: zodResolver(BadgeSchema),
    defaultValues: {
      key: "",
      name: "",
      description: "",
      icon: "",
    },
  });

  const newsForm = useForm<NewsCreate>({
    resolver: zodResolver(NewsSchema),
    defaultValues: {
      title: "",
      content: "",
      excerpt: "",
      category: "announcement",
      image_url: "",
      author: null,
      is_pinned: false,
      is_published: true,
    },
  });

  const postForm = useForm<PostCreate>({
    resolver: zodResolver(PostSchema),
    defaultValues: {
      content: "",
      media_urls: [],
    },
  });

  // CLERK MIGRATION: Updated to use vendor applications API
  const [denialMessage, setDenialMessage] = useState("");
  const [applicationToDeny, setApplicationToDeny] = useState<string | null>(null);
  const [isDenyDialogOpen, setIsDenyDialogOpen] = useState(false);

  const approveVendorMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(`/api/vendor/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve vendor');
      }
      const data = await response.json();
      // Handle standardized API response format: { success: true, data: { application: ... } }
      const application = data.data?.application || data.application;
      return { ...data, application, applicationId };
    },
    onSuccess: (data, applicationId) => {
      // Get vendor user_id from the response or application
      const application = data.application || data.data?.application;
      const vendorUserId = application?.user_id;
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["admin", "vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "vendors"] });
      if (vendorUserId) {
        queryClient.invalidateQueries({ queryKey: ["vendorProfile", vendorUserId] });
        queryClient.invalidateQueries({ queryKey: ["profile", vendorUserId] });
        queryClient.invalidateQueries({ queryKey: ["vendorStatus", vendorUserId] });
      }
      // Also invalidate all vendor profiles to catch any
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      
      toast({ title: "Vendor approved successfully" });
      logEvent("vendor_approved", "vendor", { resourceId: applicationId });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve vendor'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const rejectVendorMutation = useMutation({
    mutationFn: async ({ applicationId, message }: { applicationId: string; message?: string }) => {
      const response = await fetch(`/api/vendor/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ action: 'deny', message }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject vendor');
      }
      const data = await response.json();
      // Handle standardized API response format: { success: true, data: { application: ... } }
      const application = data.data?.application || data.application;
      return { ...data, application, applicationId };
    },
    onSuccess: (data, { applicationId }) => {
      // Get vendor user_id from the response or application
      const application = data.application || data.data?.application;
      const vendorUserId = application?.user_id;
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["admin", "vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "vendors"] });
      if (vendorUserId) {
        queryClient.invalidateQueries({ queryKey: ["vendorProfile", vendorUserId] });
        queryClient.invalidateQueries({ queryKey: ["profile", vendorUserId] });
        queryClient.invalidateQueries({ queryKey: ["vendorStatus", vendorUserId] });
      }
      // Also invalidate all vendor profiles to catch any
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      
      toast({ title: "Vendor application rejected" });
      setIsDenyDialogOpen(false);
      setDenialMessage("");
      setApplicationToDeny(null);
      logEvent("vendor_rejected", "vendor", { resourceId: applicationId });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject vendor'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createBadgeMutation = useMutation({
    mutationFn: createBadge,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "badges"] });
      toast({ title: "Badge created successfully" });
      setIsCreateBadgeDialogOpen(false);
      badgeForm.reset();
      logEvent("badge_created", "badge", { resourceId: data.id });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create badge'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateBadgeMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BadgeCreate> }) => updateBadge(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "badges"] });
      toast({ title: "Badge updated successfully" });
      setEditingBadge(null);
      badgeForm.reset();
      logEvent("badge_updated", "badge", { resourceId: id });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update badge'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteBadgeMutation = useMutation({
    mutationFn: deleteBadge,
    onSuccess: (_, badgeId) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "badges"] });
      toast({ title: "Badge deleted successfully" });
      logEvent("badge_deleted", "badge", { resourceId: badgeId });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete badge'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createNewsMutation = useMutation({
    mutationFn: createNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast({ title: "News article created successfully" });
      setIsCreateNewsDialogOpen(false);
      newsForm.reset();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create news article'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateNewsMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NewsCreate> }) => updateNews(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast({ title: "News article updated successfully" });
      setEditingNews(null);
      newsForm.reset();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update news article'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteNewsMutation = useMutation({
    mutationFn: deleteNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast({ title: "News article deleted successfully" });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete news article'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: createPublicPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
      queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
      toast({ title: "Public post created successfully" });
      setIsCreatePostDialogOpen(false);
      postForm.reset();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create post'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>You do not have permission to access this page</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const filteredUsers = users?.filter(
    (u) =>
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // CLERK MIGRATION: Use vendor applications data
  const pendingVendors = vendorApplicationsData || [];
  const verifiedVendors = vendors?.filter((v) => v.vendor_verified) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
                <Shield className="h-8 w-8" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Manage users, vendors, gamification, and content</p>
            </div>
            {profile && (
              <Button
                variant="outline"
                onClick={() => router.push(`/profile/${profile.id}`)}
              >
                View My Profile
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Vendors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats?.totalVendors || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Listings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats?.totalListings || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Posts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats?.totalPosts || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>News</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats?.totalNews || 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-9">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="gamification">Gamification</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="news">News</TabsTrigger>
              <TabsTrigger value="ads">Ads</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveTab("vendors")}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Review Vendor Applications ({pendingVendors.length})
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveTab("gamification")}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      Manage Badges ({badges?.length || 0})
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setIsCreatePostDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Public Post
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setIsCreateNewsDialogOpen(true)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Create News Article
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Registrations</CardTitle>
                    <CardDescription>New users registered in the last 7 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentRegistrations onViewAllUsers={() => setActiveTab("users")} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <Card key={user.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback>{user.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{user.display_name || user.username}</p>
                                {user.is_admin && (
                                  <Badge variant="destructive">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}
                                {user.is_vendor && (
                                  <Badge variant={user.vendor_verified ? "default" : "secondary"}>
                                    {user.vendor_verified ? "Verified Vendor" : "Vendor"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">@{user.username}</p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span>Points: {user.points || 0}</span>
                                <span>Credits: {user.credits || 0}</span>
                                {user.created_at && (
                                  <span>Joined: {format(new Date(user.created_at), "MMM yyyy")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => router.push(`/profile/${user.id}`)}>
                              View Profile
                            </Button>
                            <Button variant="default" size="sm" onClick={() => {
                              // Use Clerk ID if available, fallback to profile UUID
                              const userId = (user as any).clerk_user_id || user.id;
                              router.push(`/admin/users/${userId}`);
                            }}>
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No users found</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Vendors Tab */}
            <TabsContent value="vendors" className="space-y-4">
              <Tabs defaultValue="pending" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="pending">Pending ({pendingVendors.length})</TabsTrigger>
                  <TabsTrigger value="verified">Verified ({verifiedVendors.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4">
                  {vendorApplicationsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : vendorApplicationsError ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <XCircle className="h-12 w-12 text-destructive mb-4" />
                        <p className="text-destructive font-semibold mb-2">Failed to load vendor applications</p>
                        <p className="text-muted-foreground text-sm text-center">
                          {vendorApplicationsError instanceof Error 
                            ? vendorApplicationsError.message 
                            : 'An unknown error occurred'}
                        </p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "vendor-applications"] })}
                        >
                          Retry
                        </Button>
                      </CardContent>
                    </Card>
                  ) : pendingVendors.length > 0 ? (
                    <div className="space-y-4">
                      {pendingVendors.map((application: any) => (
                        <VendorApplicationCard
                          key={application.id}
                          application={application}
                          onApprove={() => approveVendorMutation.mutate(application.id)}
                          onReject={() => {
                            setApplicationToDeny(application.id);
                            setIsDenyDialogOpen(true);
                          }}
                          isApproving={approveVendorMutation.isPending}
                          isRejecting={rejectVendorMutation.isPending}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No pending vendor applications</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="verified" className="space-y-4">
                  {vendorsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : verifiedVendors.length > 0 ? (
                    <div className="space-y-4">
                      {verifiedVendors.map((vendor) => (
                        <VendorCard
                          key={vendor.id}
                          vendor={vendor}
                          onApprove={undefined}
                          onReject={() => {
                            if (confirm("Revoke vendor status for this user?")) {
                              rejectVendorMutation.mutate(vendor.id);
                            }
                          }}
                          isApproving={false}
                          isRejecting={rejectVendorMutation.isPending}
                          isVerified={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground">No verified vendors yet</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Products/Listings Tab */}
            <TabsContent value="products" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Products & Listings</h2>
                  <p className="text-muted-foreground">
                    Manage all marketplace listings
                  </p>
                </div>
              </div>

              <ProductsManagementTab />
            </TabsContent>

            {/* Gamification Tab */}
            <TabsContent value="gamification" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Badge Management</h3>
                  <p className="text-sm text-muted-foreground">Create and manage badges for gamification</p>
                </div>
                <Dialog open={isCreateBadgeDialogOpen} onOpenChange={setIsCreateBadgeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Badge
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Badge</DialogTitle>
                      <DialogDescription>Add a new badge to the gamification system</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={badgeForm.handleSubmit((data) => {
                        if (editingBadge) {
                          updateBadgeMutation.mutate({ id: editingBadge, updates: data });
                        } else {
                          createBadgeMutation.mutate(data);
                        }
                      })}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="badge_key">Badge Key *</Label>
                        <Input
                          id="badge_key"
                          {...badgeForm.register("key")}
                          placeholder="e.g., top_contributor"
                          disabled={!!editingBadge}
                        />
                        {badgeForm.formState.errors.key && (
                          <p className="text-sm text-destructive">{badgeForm.formState.errors.key.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="badge_name">Badge Name *</Label>
                        <Input id="badge_name" {...badgeForm.register("name")} placeholder="e.g., Top Contributor" />
                        {badgeForm.formState.errors.name && (
                          <p className="text-sm text-destructive">{badgeForm.formState.errors.name.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="badge_description">Description</Label>
                        <Textarea
                          id="badge_description"
                          {...badgeForm.register("description")}
                          placeholder="Badge description"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="badge_icon">Icon (emoji)</Label>
                        <Input id="badge_icon" {...badgeForm.register("icon")} placeholder="≡ƒÅå" />
                      </div>
                      <Button type="submit" className="w-full" disabled={createBadgeMutation.isPending || updateBadgeMutation.isPending}>
                        {createBadgeMutation.isPending || updateBadgeMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {editingBadge ? "Updating..." : "Creating..."}
                          </>
                        ) : editingBadge ? (
                          "Update Badge"
                        ) : (
                          "Create Badge"
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {badgesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : badges && badges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {badges.map((badge) => (
                    <Card key={badge.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{badge.icon || "≡ƒÅà"}</span>
                            <CardTitle className="text-lg">{badge.name}</CardTitle>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingBadge(badge.id);
                                badgeForm.reset({
                                  key: badge.key,
                                  name: badge.name,
                                  description: badge.description || "",
                                  icon: badge.icon || "",
                                });
                                setIsCreateBadgeDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Delete this badge?")) {
                                  deleteBadgeMutation.mutate(badge.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{badge.description || "No description"}</p>
                        <Badge variant="outline" className="mt-2">
                          Key: {badge.key}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Award className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No badges yet. Create your first badge!</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Public Posts</h3>
                  <p className="text-sm text-muted-foreground">Create public posts as the platform</p>
                </div>
                <Dialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Public Post</DialogTitle>
                      <DialogDescription>Create a post that will be visible to all users</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={postForm.handleSubmit((data) => createPostMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="post_content">Content *</Label>
                        <Textarea
                          id="post_content"
                          {...postForm.register("content")}
                          placeholder="What's on your mind?"
                          rows={6}
                        />
                        {postForm.formState.errors.content && (
                          <p className="text-sm text-destructive">{postForm.formState.errors.content.message}</p>
                        )}
                      </div>
                      <Button type="submit" className="w-full" disabled={createPostMutation.isPending}>
                        {createPostMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Post"
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">View and manage posts in the Explore page</p>
                  <Button variant="outline" className="mt-4" onClick={() => router.push("/explore")}>
                    Go to Explore
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* News Tab */}
            <TabsContent value="news" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">News Articles</h3>
                  <p className="text-sm text-muted-foreground">Manage platform news and announcements</p>
                </div>
                <Dialog open={isCreateNewsDialogOpen} onOpenChange={setIsCreateNewsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create News
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingNews ? "Edit News Article" : "Create News Article"}</DialogTitle>
                      <DialogDescription>Create a news article for the platform</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={newsForm.handleSubmit((data) => {
                        const submitData: NewsCreate = {
                          ...data,
                          image_url: data.image_url === "" ? null : data.image_url || null,
                          excerpt: data.excerpt === "" ? null : data.excerpt || null,
                        };
                        if (editingNews) {
                          updateNewsMutation.mutate({ id: editingNews, updates: submitData });
                        } else {
                          createNewsMutation.mutate(submitData);
                        }
                      })}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="news_title">Title *</Label>
                        <Input id="news_title" {...newsForm.register("title")} placeholder="News title" />
                        {newsForm.formState.errors.title && (
                          <p className="text-sm text-destructive">{newsForm.formState.errors.title.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="news_excerpt">Excerpt</Label>
                        <Textarea
                          id="news_excerpt"
                          {...newsForm.register("excerpt")}
                          placeholder="Short summary"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="news_content">Content *</Label>
                        <Textarea
                          id="news_content"
                          {...newsForm.register("content")}
                          placeholder="Full article content"
                          rows={8}
                        />
                        {newsForm.formState.errors.content && (
                          <p className="text-sm text-destructive">{newsForm.formState.errors.content.message}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="news_category">Category</Label>
                          <Select
                            value={newsForm.watch("category")}
                            onValueChange={(value: "announcement" | "update" | "feature" | "community") =>
                              newsForm.setValue("category", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="announcement">Announcement</SelectItem>
                              <SelectItem value="update">Update</SelectItem>
                              <SelectItem value="feature">Feature</SelectItem>
                              <SelectItem value="community">Community</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="news_image">Image URL (optional)</Label>
                          <Input
                            id="news_image"
                            type="url"
                            {...newsForm.register("image_url")}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="news_pinned"
                            checked={newsForm.watch("is_pinned")}
                            onChange={(e) => newsForm.setValue("is_pinned", e.target.checked)}
                            className="rounded"
                          />
                          <Label htmlFor="news_pinned">Pin to top</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="news_published"
                            checked={newsForm.watch("is_published")}
                            onChange={(e) => newsForm.setValue("is_published", e.target.checked)}
                            className="rounded"
                          />
                          <Label htmlFor="news_published">Published</Label>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createNewsMutation.isPending || updateNewsMutation.isPending}
                      >
                        {createNewsMutation.isPending || updateNewsMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {editingNews ? "Updating..." : "Creating..."}
                          </>
                        ) : editingNews ? (
                          "Update Article"
                        ) : (
                          "Create Article"
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {newsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : news && news.length > 0 ? (
                <div className="space-y-4">
                  {news.map((item) => (
                    <Card key={item.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle>{item.title}</CardTitle>
                              {item.is_pinned && <Badge variant="default">Pinned</Badge>}
                              <Badge variant="outline">{item.category}</Badge>
                              {!item.is_published && <Badge variant="secondary">Draft</Badge>}
                            </div>
                            {item.excerpt && <CardDescription>{item.excerpt}</CardDescription>}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingNews(item.id);
                                newsForm.reset({
                                  title: item.title,
                                  content: item.content,
                                  excerpt: item.excerpt || "",
                                  category: item.category as "announcement" | "update" | "feature" | "community",
                                  is_pinned: item.is_pinned || false,
                                  is_published: item.is_published,
                                  image_url: item.image_url || "",
                                  author: item.author || null,
                                });
                                setIsCreateNewsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Delete this news article?")) {
                                  deleteNewsMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Views: {item.view_count || 0}</span>
                          {item.created_at && (
                            <span>Created: {format(new Date(item.created_at), "MMM d, yyyy")}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No news articles yet. Create your first one!</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="news" className="space-y-4">
              <NewsManagementTab />
            </TabsContent>

            <TabsContent value="ads" className="space-y-4">
              <AdsManagementSection />
            </TabsContent>

            {/* Audit Logs Tab */}
            <TabsContent value="audit" className="space-y-4">
              <AuditLogViewer />
            </TabsContent>
          </Tabs>

          {/* Denial Dialog */}
          <Dialog open={isDenyDialogOpen} onOpenChange={setIsDenyDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Vendor Application</DialogTitle>
                <DialogDescription>
                  Please provide a reason for rejecting this vendor application. This message will be sent to the applicant.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="denial-message">Rejection Reason (Optional)</Label>
                  <Textarea
                    id="denial-message"
                    placeholder="e.g., Missing required documents, Business information incomplete..."
                    value={denialMessage}
                    onChange={(e) => setDenialMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDenyDialogOpen(false);
                      setDenialMessage("");
                      setApplicationToDeny(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (applicationToDeny) {
                        rejectVendorMutation.mutate({
                          applicationId: applicationToDeny,
                          message: denialMessage || undefined,
                        });
                      }
                    }}
                    disabled={rejectVendorMutation.isPending}
                  >
                    {rejectVendorMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      "Reject Application"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageShell>
    </div>
  );
}

function NewsManagementTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: allNews, isLoading: newsLoading } = useQuery({
    queryKey: ["admin", "news"],
    queryFn: () => getAllNews(0, 100),
  });

  const form = useForm<NewsCreate>({
    resolver: zodResolver(NewsCreateSchema),
    defaultValues: {
      title: "",
      content: "",
      excerpt: "",
      image_url: "",
      category: "announcement",
      is_pinned: false,
      is_published: true,
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const createNewsMutation = useMutation({
    mutationFn: async (data: NewsCreate) => {
      let imageUrl = data.image_url;
      if (imageFile && user) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `news/${Date.now()}.${fileExt}`;
        imageUrl = await uploadFile("news", fileName, imageFile);
      }
      return createNews({ ...data, image_url: imageUrl || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setImageFile(null);
      setImagePreview(null);
      toast({ title: "News article created successfully" });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create news article'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateNewsMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NewsCreate> }) => {
      let imageUrl = updates.image_url;
      if (imageFile && user) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `news/${Date.now()}.${fileExt}`;
        imageUrl = await uploadFile("news", fileName, imageFile);
      }
      return updateNews(id, { ...updates, image_url: imageUrl || updates.image_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setEditingNews(null);
      form.reset();
      setImageFile(null);
      setImagePreview(null);
      toast({ title: "News article updated successfully" });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update news article'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteNewsMutation = useMutation({
    mutationFn: deleteNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast({ title: "News article deleted successfully" });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete news article'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (news: News) => {
    setEditingNews(news);
    form.reset({
      title: news.title,
      content: news.content,
      excerpt: news.excerpt || "",
      image_url: news.image_url || "",
      category: news.category,
      is_pinned: news.is_pinned,
      is_published: news.is_published,
    });
    setImagePreview(news.image_url || null);
  };

  const handleSubmit = async (data: NewsCreate) => {
    if (editingNews) {
      updateNewsMutation.mutate({ id: editingNews.id, updates: data });
    } else {
      createNewsMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">News Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage news articles</p>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingNews} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingNews(null);
            form.reset();
            setImageFile(null);
            setImagePreview(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create News Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingNews ? "Edit News Article" : "Create News Article"}</DialogTitle>
              <DialogDescription>
                {editingNews ? "Update the news article details" : "Create a new news article for the platform"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" {...form.register("title")} placeholder="Enter news title" />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  {...form.register("excerpt")}
                  placeholder="Brief summary (optional)"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  {...form.register("content")}
                  placeholder="Full article content"
                  rows={8}
                />
                {form.formState.errors.content && (
                  <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={form.watch("category")}
                    onValueChange={(value) => form.setValue("category", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">Image</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_pinned"
                    checked={form.watch("is_pinned")}
                    onCheckedChange={(checked) => form.setValue("is_pinned", checked)}
                  />
                  <Label htmlFor="is_pinned">Pin to top</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_published"
                    checked={form.watch("is_published")}
                    onCheckedChange={(checked) => form.setValue("is_published", checked)}
                  />
                  <Label htmlFor="is_published">Published</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingNews(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createNewsMutation.isPending || updateNewsMutation.isPending}
                >
                  {createNewsMutation.isPending || updateNewsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingNews ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingNews ? "Update Article" : "Create Article"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {newsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : allNews && allNews.length > 0 ? (
        <div className="space-y-4">
          {allNews.map((news) => (
            <Card key={news.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{news.title}</h3>
                      {news.is_pinned && (
                        <Badge variant="default" className="bg-primary">
                          Pinned
                        </Badge>
                      )}
                      {!news.is_published && (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      <Badge variant="outline">{news.category}</Badge>
                    </div>
                    {news.excerpt && (
                      <p className="text-sm text-muted-foreground mb-2">{news.excerpt}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Views: {news.view_count || 0}</span>
                      {news.created_at && (
                        <span>Created: {format(new Date(news.created_at), "PPp")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(news)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this news article?")) {
                          deleteNewsMutation.mutate(news.id);
                        }
                      }}
                      disabled={deleteNewsMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No news articles yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdsManagementSection() {
  const placements = ["home", "feed", "marketplace", "news", "notifications"] as const
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    image_url: "",
    cta_text: "",
    cta_url: "",
    placements: ["feed"] as string[],
    is_active: true,
  })

  const { data: ads, isLoading } = useQuery({
    queryKey: ["adminAds"],
    queryFn: getAllAds,
  })

  const createMutation = useMutation({
    mutationFn: () => createAdEntry(formState),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAds"] })
      toast({ title: "Ad created!" })
      setFormState({
        title: "",
        description: "",
        image_url: "",
        cta_text: "",
        cta_url: "",
        placements: ["feed"],
        is_active: true,
      })
    },
    onError: () => toast({ title: "Failed to create ad", variant: "destructive" }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Ad> }) => updateAdEntry(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAds"] })
      toast({ title: "Ad updated" })
    },
    onError: () => toast({ title: "Failed to update ad", variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAds"] })
      toast({ title: "Ad deleted" })
    },
    onError: () => toast({ title: "Failed to delete ad", variant: "destructive" }),
  })

  const togglePlacement = (placement: string) => {
    setFormState((prev) => {
      const exists = prev.placements.includes(placement)
      const next = exists
        ? prev.placements.filter((p) => p !== placement)
        : [...prev.placements, placement]
      return { ...prev, placements: next.length ? next : prev.placements }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create new ad</CardTitle>
          <CardDescription>Configure sponsored placements across the app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Ad title"
            value={formState.title}
            onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
          />
          <Textarea
            placeholder="Description"
            value={formState.description}
            onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
          />
          <Input
            placeholder="Image URL"
            value={formState.image_url}
            onChange={(e) => setFormState((prev) => ({ ...prev, image_url: e.target.value }))}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="CTA text"
              value={formState.cta_text}
              onChange={(e) => setFormState((prev) => ({ ...prev, cta_text: e.target.value }))}
            />
            <Input
              placeholder="CTA link (https://...)"
              value={formState.cta_url}
              onChange={(e) => setFormState((prev) => ({ ...prev, cta_url: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Placements</p>
            <div className="flex flex-wrap gap-2">
              {placements.map((placement) => {
                const active = formState.placements.includes(placement)
                return (
                  <Button
                    key={placement}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => togglePlacement(placement)}
                  >
                    {placement}
                  </Button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="ad-active"
              checked={formState.is_active}
              onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="ad-active">Active</Label>
          </div>
          <Button
            onClick={() => {
              if (!formState.title.trim()) {
                toast({ title: "Title is required", variant: "destructive" })
                return
              }
              createMutation.mutate()
            }}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Publishing..." : "Publish ad"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active ads</CardTitle>
          <CardDescription>Manage campaigns across the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading ads...
            </div>
          ) : !ads || ads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ads yet.</p>
          ) : (
            ads.map((ad) => (
              <Card key={ad.id} className="border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{ad.title}</CardTitle>
                      <CardDescription className="text-xs">
                        Placements: {ad.placements.join(", ")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ad.is_active ? "default" : "secondary"}>
                        {ad.is_active ? "Active" : "Paused"}
                      </Badge>
                      <Switch
                        checked={ad.is_active}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: ad.id, updates: { is_active: checked } })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this ad?")) {
                            deleteMutation.mutate(ad.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {ad.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{ad.description}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProductsManagementTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");

  // Fetch all listings
  const { data: listings, isLoading } = useQuery({
    queryKey: ["admin", "all-listings"],
    queryFn: async () => {
      return await getListings(0, 100); // Get first 100 listings
    },
  });

  // Fetch verified vendors for dropdown
  const { data: vendors } = useQuery({
    queryKey: ["admin", "verified-vendors"],
    queryFn: () => getAllVendors(0, 500),
  });

  // Delete listing mutation
  const deleteMutation = useMutation({
    mutationFn: async (listingId: string) => {
      await deleteListing(listingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "all-listings"] });
      toast({
        title: "Success",
        description: "Listing deleted successfully",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete listing'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Create listing mutation
  const createMutation = useMutation({
    mutationFn: async (data: ListingCreate) => {
      return await createListing(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "all-listings"] });
      setIsCreateDialogOpen(false);
      setSelectedVendorId(""); // Reset vendor selection
      toast({
        title: "Success",
        description: "Listing created successfully",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create listing'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update listing mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ListingUpdate }) => {
      return await updateListing(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "all-listings"] });
      setIsEditDialogOpen(false);
      setEditingListing(null);
      toast({
        title: "Success",
        description: "Listing updated successfully",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update listing'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (listing: Listing) => {
    setEditingListing(listing);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (listingId: string, title: string) => {
    if (confirm(`Delete listing "${title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(listingId);
    }
  };

  const filteredListings = listings?.filter((listing) =>
    listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search and Create */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search listings by title or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Listing
        </Button>
        <Badge variant="secondary">{filteredListings?.length || 0} listings</Badge>
      </div>

      {/* Listings Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredListings && filteredListings.length > 0 ? (
        <div className="grid gap-4">
          {filteredListings.map((listing) => (
            <Card key={listing.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {listing.title}
                      {!listing.active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Category: {listing.category || "Uncategorized"} ΓÇó 
                      Price: ${listing.price} ΓÇó 
                      Quantity: {listing.quantity}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(listing)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(listing.id, listing.title)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {listing.description || "No description"}
                </p>
                {listing.images && listing.images.length > 0 && (
                  <div className="mt-3">
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="h-24 w-24 rounded object-cover"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "No listings match your search" : "No listings found"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!createMutation.isPending) {
          setIsCreateDialogOpen(open);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Listing</DialogTitle>
            <DialogDescription>
              Create a new product or service listing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-title">Title *</Label>
              <Input 
                id="create-title" 
                placeholder="Listing title" 
                disabled={createMutation.isPending}
              />
            </div>
            <div>
              <Label htmlFor="create-description">Description</Label>
              <Textarea 
                id="create-description" 
                placeholder="Listing description" 
                rows={3} 
                disabled={createMutation.isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-price">Price *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  id="create-price" 
                  placeholder="0.00" 
                  disabled={createMutation.isPending}
                />
              </div>
              <div>
                <Label htmlFor="create-quantity">Quantity</Label>
                <Input 
                  type="number" 
                  id="create-quantity" 
                  placeholder="0" 
                  defaultValue={0} 
                  disabled={createMutation.isPending}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="create-category">Category</Label>
              <Input 
                id="create-category" 
                placeholder="Category" 
                disabled={createMutation.isPending}
              />
            </div>
            <div>
              <Label htmlFor="create-vendor">Vendor</Label>
              <Select
                value={selectedVendorId}
                onValueChange={setSelectedVendorId}
                disabled={createMutation.isPending}
              >
                <SelectTrigger id="create-vendor">
                  <SelectValue placeholder="Select vendor (optional - defaults to you)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__self__">My Account (Default)</SelectItem>
                  {vendors?.filter(v => v.vendor_verified).map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.display_name || vendor.username || vendor.email} ({vendor.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Leave as default to assign the listing to your own account.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="create-active" 
                defaultChecked={true} 
                disabled={createMutation.isPending}
              />
              <Label htmlFor="create-active">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const title = (document.getElementById("create-title") as HTMLInputElement)?.value;
                  const description = (document.getElementById("create-description") as HTMLTextAreaElement)?.value;
                  const price = parseFloat((document.getElementById("create-price") as HTMLInputElement)?.value);
                  const quantity = parseInt((document.getElementById("create-quantity") as HTMLInputElement)?.value || "0");
                  const category = (document.getElementById("create-category") as HTMLInputElement)?.value;
                  const active = (document.getElementById("create-active") as HTMLInputElement)?.checked;
                  const vendorId = selectedVendorId && selectedVendorId !== "__self__" ? selectedVendorId : undefined;

                  // Client-side validation
                  if (!title || !price) {
                    toast({
                      title: "Validation Error",
                      description: "Title and price are required",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (isNaN(price) || price < 0) {
                    toast({
                      title: "Invalid Price",
                      description: "Price must be a positive number",
                      variant: "destructive",
                    });
                    return;
                  }

                  createMutation.mutate({
                    title,
                    description: description || "",
                    price,
                    quantity: quantity || 0,
                    category: category || "",
                    vendor: vendorId || undefined,
                    active: active !== false,
                    currency: "USD",
                    images: [],
                  });
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Listing"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
            <DialogDescription>
              Update listing details
            </DialogDescription>
          </DialogHeader>
          {editingListing && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  defaultValue={editingListing.title}
                  id="edit-title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  defaultValue={editingListing.description || ""}
                  id="edit-description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editingListing.price}
                    id="edit-price"
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    defaultValue={editingListing.quantity}
                    id="edit-quantity"
                  />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  defaultValue={editingListing.category || ""}
                  id="edit-category"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  defaultChecked={editingListing.active}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingListing(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const title = (document.getElementById("edit-title") as HTMLInputElement)?.value;
                    const description = (document.getElementById("edit-description") as HTMLTextAreaElement)?.value;
                    const price = parseFloat((document.getElementById("edit-price") as HTMLInputElement)?.value);
                    const quantity = parseInt((document.getElementById("edit-quantity") as HTMLInputElement)?.value);
                    const category = (document.getElementById("edit-category") as HTMLInputElement)?.value;
                    const active = (document.getElementById("edit-active") as HTMLInputElement)?.checked;

                    updateMutation.mutate({
                      id: editingListing.id,
                      updates: {
                        title,
                        description,
                        price,
                        quantity,
                        category,
                        active,
                      },
                    });
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecentRegistrations({ onViewAllUsers }: { onViewAllUsers: () => void }) {
  const { data: recentUsers, isLoading } = useQuery({
    queryKey: ["admin", "recent-users"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!recentUsers || recentUsers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No new registrations in the last 7 days</p>
    );
  }

  return (
    <div className="space-y-3">
      {recentUsers.map((user) => (
        <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {user.username?.[0]?.toUpperCase() || user.display_name?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user.display_name || user.username || "Unknown User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{user.username || "unknown"}
            </p>
          </div>
          <div className="text-right">
            {user.created_at && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(user.created_at), "MMM d")}
              </p>
            )}
            {user.is_vendor && (
              <Badge variant="secondary" className="text-xs mt-1">
                Vendor
              </Badge>
            )}
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2"
        onClick={onViewAllUsers}
      >
        View All Users
      </Button>
    </div>
  );
}

// CLERK MIGRATION: New component for vendor applications
function VendorApplicationCard({
  application,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  application: any;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const profile = application.profile;
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || "V"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-base sm:text-lg truncate">{profile?.display_name || profile?.username || "Unknown"}</h3>
                <Badge variant="secondary" className="text-xs flex-shrink-0">Pending Review</Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">@{profile?.username || "unknown"}</p>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="break-words"><strong>Business Name:</strong> {application.business_name}</p>
                <p className="break-words"><strong>Business Type:</strong> {application.business_type}</p>
                {application.tax_id && <p className="break-words"><strong>Tax ID:</strong> {application.tax_id}</p>}
                {application.phone_number && <p><strong>Phone:</strong> {application.phone_number}</p>}
                {application.notes && <p className="break-words"><strong>Notes:</strong> {application.notes}</p>}
                {application.submitted_at && (
                  <p className="text-muted-foreground text-xs">
                    Submitted: {format(new Date(application.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
              {application.id_document_url && (
                <div className="mt-2">
                  <a 
                    href={application.id_document_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 min-h-[44px]"
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    View ID Document
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-shrink-0">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={onApprove} 
                disabled={isApproving || isRejecting} 
                className="bg-primary min-h-[44px] flex-1 sm:flex-initial"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={onReject}
                disabled={isApproving || isRejecting}
                className="min-h-[44px] flex-1 sm:flex-initial"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </>
                )}
              </Button>
            </div>
            {(application?.user_id || profile?.clerk_user_id) && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    // Use Clerk ID from profile if available, otherwise use application.user_id (which is profile UUID)
                    // The API route will handle both, but Clerk ID is preferred
                    const userId = (profile as any)?.clerk_user_id || application.user_id;
                    window.location.href = `/admin/users/${userId}`;
                  }
                }}
              >
                View User Profile
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VendorCard({
  vendor,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  isVerified = false,
}: {
  vendor: Profile;
  onApprove?: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  isVerified?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
              <AvatarImage src={vendor.avatar_url || undefined} />
              <AvatarFallback>{vendor.username?.[0]?.toUpperCase() || "V"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-base sm:text-lg truncate">{vendor.display_name || vendor.username}</h3>
                {vendor.vendor_verified && (
                  <VerifiedVendorBadge size="sm" className="flex-shrink-0" />
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">@{vendor.username}</p>
              {vendor.bio && <p className="text-xs sm:text-sm mt-2 line-clamp-2">{vendor.bio}</p>}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
                <span>Points: {vendor.points || 0}</span>
                {vendor.created_at && <span>Joined: {format(new Date(vendor.created_at), "MMM yyyy")}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-shrink-0">
            {!isVerified && onApprove && (
              <Button 
                onClick={onApprove} 
                disabled={isApproving || isRejecting} 
                className="bg-primary min-h-[44px] w-full sm:w-auto"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
            )}
            <Button
              variant={isVerified ? "outline" : "destructive"}
              onClick={onReject}
              disabled={isApproving || isRejecting}
              className="min-h-[44px] w-full sm:w-auto"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  {isVerified ? "Revoke" : "Reject"}
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // Use Clerk ID if available, fallback to profile UUID
                  const userId = (vendor as any).clerk_user_id || vendor.id;
                  window.location.href = `/admin/users/${userId}`;
                }
              }}
              className="min-h-[44px] w-full sm:w-auto"
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
