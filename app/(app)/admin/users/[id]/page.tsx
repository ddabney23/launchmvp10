'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import {
  Loader2,
  ArrowLeft,
  Save,
  Shield,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const userId = resolvedParams.id
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user: currentUser, profile: currentProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Check if current user is admin
  const isAdmin = !!currentProfile?.is_admin

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: '',
    avatar_url: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    school: '',
    is_vendor: false,
    vendor_verified: false,
    is_admin: false,
    points: 0,
    credits: 0,
    reputation_score: 0,
    account_status: 'active' as 'active' | 'suspended' | 'banned',
    admin_notes: '',
  })

  // Fetch user data
  const { data: userData, isLoading, error } = useQuery<{
    success: true
    data: {
      profile: {
        id: string
        username: string | null
        display_name: string | null
        bio: string | null
        avatar_url: string | null
        email: string | null
        phone: string | null
        city: string | null
        state: string | null
        school: string | null
        is_vendor: boolean
        vendor_verified: boolean
        is_admin: boolean | null
        points: number
        credits: number
        reputation_score: number | null
        account_status: 'active' | 'suspended' | 'banned' | null
        admin_notes: string | null
        created_at: string
        vendor_profile?: {
          business_name: string | null
          business_email: string | null
          business_phone: string | null
          payout_balance: number | null
          subscription_tier: string | null
          subscription_status: string | null
          listing_limit: number | null
          transaction_fee_percent: number | null
          stripe_onboard_status: string | null
        }
      }
      stats: {
        posts_count: number
        listings_count: number
        orders_count: number
        followers_count: number
        following_count: number
      }
      recent_posts: Array<{ id: string; content: string; created_at: string }>
      vendor_application: {
        id: string
        business_name: string
        business_address: string | Record<string, unknown> | null
        phone_number: string | null
        submitted_at: string
        reviewed_at: string | null
        denial_reason: string | null
        status: string
      } | null
    }
  }>({
    queryKey: ['admin', 'user', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required')
      }
      
      try {
        console.log('[Admin User Page] Fetching user profile:', { userId, url: `/api/admin/users/${userId}` })
        
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })
        
        console.log('[Admin User Page] Response status:', response.status, response.statusText)
        
        if (!response.ok) {
          let errorData: any = {}
          let responseText = ''
          
          try {
            const contentType = response.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              errorData = await response.json()
            } else {
              responseText = await response.text()
              errorData = { error: responseText || `HTTP ${response.status}: ${response.statusText}` }
            }
          } catch (parseError) {
            try {
              responseText = await response.text()
              errorData = { 
                error: `HTTP ${response.status}: ${response.statusText}`,
                details: responseText || 'Failed to parse error response',
                parseError: parseError instanceof Error ? parseError.message : String(parseError)
              }
            } catch (textError) {
              errorData = { 
                error: `HTTP ${response.status}: ${response.statusText}`,
                details: 'Failed to read response body'
              }
            }
          }
          
          const errorMessage = errorData.error || errorData.message || `Failed to fetch user (${response.status})`
          console.error('[Admin User Page] Fetch error:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            userId,
            url: response.url,
          })
          throw new Error(errorMessage)
        }
        
        const result = await response.json()
        console.log('[Admin User Page] Fetch success:', { 
          userId, 
          hasData: !!result.data,
          hasSuccess: result.success !== undefined,
          resultKeys: Object.keys(result)
        })
        
        // Handle both wrapped and unwrapped responses
        if (result.success && result.data) {
          return result
        }
        // Fallback for unwrapped responses (backward compatibility)
        return { success: true as const, data: result }
      } catch (error) {
        // Handle network errors specifically
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error('[Admin User Page] Network error:', {
            error: error.message,
            userId,
            message: 'Failed to connect to server. Please check your internet connection.'
          })
          throw new Error('Network error: Failed to connect to server. Please check your internet connection and try again.')
        }
        
        console.error('[Admin User Page] Query error:', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          userId,
        })
        throw error
      }
    },
    enabled: isAdmin && !!userId,
  })

  // Initialize form when data loads - use useMemo to avoid setState in effect
  const initialFormData = useMemo(() => {
    const profile = userData?.data?.profile
    if (profile) {
      return {
        username: profile.username || '',
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        email: profile.email || '',
        phone: profile.phone || '',
        city: profile.city || '',
        state: profile.state || '',
        school: profile.school || '',
        is_vendor: profile.is_vendor || false,
        vendor_verified: profile.vendor_verified || false,
        is_admin: profile.is_admin || false,
        points: profile.points || 0,
        credits: profile.credits || 0,
        reputation_score: profile.reputation_score || 0,
        account_status: (profile.account_status || 'active') as 'active' | 'suspended' | 'banned',
        admin_notes: profile.admin_notes || '',
      }
    }
    return {
      username: '',
      display_name: '',
      bio: '',
      avatar_url: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      school: '',
      is_vendor: false,
      vendor_verified: false,
      is_admin: false,
      points: 0,
      credits: 0,
      reputation_score: 0,
      account_status: 'active' as 'active' | 'suspended' | 'banned',
      admin_notes: '',
    }
  }, [userData?.data?.profile])

  // Update form data when initial data changes (only when not editing)
  useEffect(() => {
    if (!isEditing && userData?.data?.profile) {
      setFormData(initialFormData)
    }
  }, [initialFormData, isEditing])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<typeof formData>) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update user' }))
        throw new Error(errorData.error || `Failed to update user: ${response.statusText}`)
      }
      const result = await response.json()
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setIsEditing(false)
      toast({
        title: 'Success',
        description: 'User profile updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  const handleCancel = () => {
    // Reset form to initial data
    setFormData(initialFormData)
    setIsEditing(false)
  }

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete user' }))
        throw new Error(errorData.error || `Failed to delete user: ${response.statusText}`)
      }
      const result = await response.json()
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast({
        title: 'Success',
        description: 'User account deleted successfully',
      })
      router.push('/admin')
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setIsDeleteDialogOpen(false)
    },
  })

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>You do not have permission to access this page</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>
                {error instanceof Error ? error.message : 'Failed to load user data'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.back()}>
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Safely extract data from response
  if (!userData?.data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>Failed to load user data</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const { profile, stats, recent_posts, vendor_application } = userData.data

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Shield className="h-8 w-8" />
                  User Management
                </h1>
                <p className="text-muted-foreground mt-1">View and edit user profile</p>
              </div>
            </div>
            {!isEditing && (
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
                {userId !== currentUser?.id && !profile.is_admin && (
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete User
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Delete User Account
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this user account? This action cannot be undone.
                          <br />
                          <br />
                          <strong>This will permanently delete:</strong>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>User profile and all personal information</li>
                            <li>All posts and comments</li>
                            <li>All listings (if vendor)</li>
                            <li>All messages and notifications</li>
                            <li>Order history</li>
                          </ul>
                          <br />
                          <strong>User:</strong> {profile.display_name || profile.username} (@{profile.username})
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteUserMutation.mutate()}
                          disabled={deleteUserMutation.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteUserMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete User'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>

          {/* User Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl">
                      {profile.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">{profile.display_name || profile.username}</h2>
                      {profile.is_admin && (
                        <Badge variant="destructive">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {profile.vendor_verified && (
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified Vendor
                        </Badge>
                      )}
                      {profile.is_vendor && !profile.vendor_verified && (
                        <Badge variant="secondary">Vendor (Unverified)</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">@{profile.username}</p>
                    {profile.bio && (
                      <p className="text-sm mt-2 max-w-2xl">{profile.bio}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-semibold">
                    {format(new Date(profile.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Posts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.posts_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Listings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.listings_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Orders</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.orders_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Followers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.followers_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Following</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.following_count}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {(profile.is_vendor || vendor_application) && (
                <TabsTrigger value="vendor">Vendor Info</TabsTrigger>
              )}
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              {isEditing ? (
                <form onSubmit={handleSubmit}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Edit Profile</CardTitle>
                      <CardDescription>Update user information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="display_name">Display Name</Label>
                          <Input
                            id="display_name"
                            value={formData.display_name}
                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={formData.bio}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="avatar_url">Avatar URL</Label>
                        <Input
                          id="avatar_url"
                          type="url"
                          value={formData.avatar_url}
                          onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="school">School</Label>
                          <Input
                            id="school"
                            value={formData.school}
                            onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="points">Points</Label>
                          <Input
                            id="points"
                            type="number"
                            value={formData.points}
                            onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="credits">Credits</Label>
                          <Input
                            id="credits"
                            type="number"
                            step="0.01"
                            value={formData.credits}
                            onChange={(e) => setFormData({ ...formData, credits: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reputation_score">Reputation</Label>
                          <Input
                            id="reputation_score"
                            type="number"
                            value={formData.reputation_score}
                            onChange={(e) => setFormData({ ...formData, reputation_score: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="admin_notes">Admin Notes (Internal)</Label>
                        <Textarea
                          id="admin_notes"
                          value={formData.admin_notes}
                          onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                          rows={3}
                          placeholder="Internal notes about this user..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="account_status">Account Status</Label>
                        <select
                          id="account_status"
                          value={formData.account_status}
                          onChange={(e) => setFormData({ ...formData, account_status: e.target.value as 'active' | 'suspended' | 'banned' })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="banned">Banned</option>
                        </select>
                      </div>

                      <div className="space-y-4 border-t pt-4">
                        <h3 className="font-semibold">Permissions & Status</h3>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="is_vendor">Vendor</Label>
                            <p className="text-sm text-muted-foreground">Allow user to sell products/services</p>
                          </div>
                          <Switch
                            id="is_vendor"
                            checked={formData.is_vendor}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_vendor: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="vendor_verified">Verified Vendor</Label>
                            <p className="text-sm text-muted-foreground">Mark vendor as verified</p>
                          </div>
                          <Switch
                            id="vendor_verified"
                            checked={formData.vendor_verified}
                            disabled={!formData.is_vendor}
                            onCheckedChange={(checked) => setFormData({ ...formData, vendor_verified: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="is_admin">Admin</Label>
                            <p className="text-sm text-muted-foreground">Grant admin privileges</p>
                          </div>
                          <Switch
                            id="is_admin"
                            checked={formData.is_admin}
                            disabled={userId === currentUser?.id}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_admin: checked })}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={handleCancel}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </form>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">User ID</p>
                        <p className="font-mono text-sm">{profile.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Account Status</p>
                        <Badge variant={profile.account_status === 'active' ? 'default' : 'destructive'}>
                          {profile.account_status || 'active'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Points</p>
                        <p className="text-lg font-semibold">{profile.points || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Credits</p>
                        <p className="text-lg font-semibold">${profile.credits || 0}</p>
                      </div>
                    </div>

                    {profile.vendor_profile && (
                      <div className="border-t pt-4">
                        <h3 className="font-semibold mb-2">Vendor Information</h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Business Name</p>
                            <p>{profile.vendor_profile.business_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Business Email</p>
                            <p>{profile.vendor_profile.business_email || 'N/A'}</p>
                          </div>
                          {profile.vendor_profile.business_phone && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Business Phone</p>
                              <p>{profile.vendor_profile.business_phone}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Payout Balance</p>
                            <p>${profile.vendor_profile.payout_balance || 0}</p>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <h4 className="font-semibold text-sm mb-2">Subscription Plan</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Tier</p>
                                <Badge variant={profile.vendor_profile.subscription_tier === 'premium' ? 'default' : profile.vendor_profile.subscription_tier === 'pro' ? 'default' : 'secondary'}>
                                  {profile.vendor_profile.subscription_tier?.toUpperCase() || 'FREE'}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Status</p>
                                <Badge variant={profile.vendor_profile.subscription_status === 'active' ? 'default' : 'secondary'}>
                                  {profile.vendor_profile.subscription_status?.toUpperCase() || 'N/A'}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Listing Limit</p>
                                <p>{profile.vendor_profile.listing_limit === -1 ? 'Unlimited' : profile.vendor_profile.listing_limit || 0}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Transaction Fee</p>
                                <p>{profile.vendor_profile.transaction_fee_percent || 0}%</p>
                              </div>
                            </div>
                            {profile.vendor_profile.stripe_onboard_status && (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-muted-foreground">Stripe Connect Status</p>
                                <Badge variant={profile.vendor_profile.stripe_onboard_status === 'complete' ? 'default' : 'secondary'}>
                                  {profile.vendor_profile.stripe_onboard_status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Badges Section */}
              <BadgesManagement userId={userId} />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Posts</CardTitle>
                  <CardDescription>Last 10 posts by this user</CardDescription>
                </CardHeader>
                <CardContent>
                  {recent_posts && recent_posts.length > 0 ? (
                    <div className="space-y-3">
                      {recent_posts.map((post) => (
                        <div key={post.id} className="border-b pb-3 last:border-0">
                          <p className="text-sm line-clamp-2">{post.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {post.created_at && format(new Date(post.created_at), 'PPp')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No posts yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vendor Tab */}
            {(profile.is_vendor || vendor_application) && (
              <TabsContent value="vendor" className="space-y-4">
                {vendor_application && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Vendor Application</CardTitle>
                      <CardDescription>
                        Application status:{' '}
                        <Badge
                          variant={
                            vendor_application.status === 'approved'
                              ? 'default'
                              : vendor_application.status === 'denied'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {vendor_application.status}
                        </Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Business Name</p>
                        <p>{vendor_application.business_name}</p>
                      </div>
                      {vendor_application.business_address && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Business Address</p>
                          <p className="text-sm">
                            {typeof vendor_application.business_address === 'string'
                              ? vendor_application.business_address
                              : JSON.stringify(vendor_application.business_address)}
                          </p>
                        </div>
                      )}
                      {vendor_application.phone_number && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                          <p>{vendor_application.phone_number}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                        <p>{format(new Date(vendor_application.submitted_at), 'PPp')}</p>
                      </div>
                      {vendor_application.reviewed_at && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Reviewed</p>
                          <p>{format(new Date(vendor_application.reviewed_at), 'PPp')}</p>
                        </div>
                      )}
                      {vendor_application.denial_reason && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Denial Reason</p>
                          <p className="text-sm text-destructive">{vendor_application.denial_reason}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  )
}

// Badges Management Component
function BadgesManagement({ userId }: { userId: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedBadgeId, setSelectedBadgeId] = useState('')

  // Types for badge data
  type Badge = {
    id: string
    key: string
    name: string
    description: string | null
    icon: string | null
  }

  type UserBadge = {
    id: string
    badge: Badge
  }

  type BadgesResponse = {
    success: true
    data: {
      badges: UserBadge[]
    }
  }

  type AllBadgesResponse = {
    success: true
    data: {
      badges: Badge[]
    }
  }

  // Fetch user's badges
  const { data: userBadgesData, isLoading: isLoadingUserBadges } = useQuery<BadgesResponse>({
    queryKey: ['admin-user-badges', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/badges`)
      if (!res.ok) throw new Error('Failed to fetch user badges')
      const result = await res.json()
      // Handle both wrapped and unwrapped responses
      if (result.success && result.data) {
        return result
      }
      return { success: true as const, data: { badges: result.badges || result || [] } }
    },
  })

  // Fetch all available badges
  const { data: allBadgesData, isLoading: isLoadingAllBadges } = useQuery<AllBadgesResponse>({
    queryKey: ['admin-all-badges'],
    queryFn: async () => {
      const res = await fetch('/api/admin/badges')
      if (!res.ok) throw new Error('Failed to fetch badges')
      const result = await res.json()
      // Handle both wrapped and unwrapped responses
      if (result.success && result.data) {
        return result
      }
      return { success: true as const, data: { badges: result.badges || result || [] } }
    },
  })

  // Add badge mutation
  const addBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      const res = await fetch(`/api/admin/users/${userId}/badges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_id: badgeId }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add badge')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-badges', userId] })
      toast({ title: 'Badge added successfully' })
      setSelectedBadgeId('')
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  // Remove badge mutation
  const removeBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      const res = await fetch(`/api/admin/users/${userId}/badges`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_id: badgeId }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove badge')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-badges', userId] })
      toast({ title: 'Badge removed successfully' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const userBadges = userBadgesData?.data?.badges || []
  const allBadges = allBadgesData?.data?.badges || []
  // Filter out badges that are already assigned to the user
  const userBadgeIds = new Set(
    userBadges
      .map((ub) => ub.badge?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )
  const availableBadges = allBadges.filter((badge) => badge.id && !userBadgeIds.has(badge.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Badges</CardTitle>
        <CardDescription>Manage user achievements and badges</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Badges */}
        <div>
          <Label className="mb-2 block">Current Badges</Label>
          {isLoadingUserBadges ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : userBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {userBadges.map((userBadge) => (
                <Badge
                  key={userBadge.id}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm flex items-center gap-2"
                >
                  {userBadge.badge?.icon && <span>{userBadge.badge.icon}</span>}
                  <span>{userBadge.badge?.name || 'Unknown'}</span>
                  {userBadge.badge?.id && (
                    <button
                      onClick={() => {
                        const badgeId = userBadge.badge?.id
                        if (badgeId) {
                          removeBadgeMutation.mutate(badgeId)
                        }
                      }}
                      disabled={removeBadgeMutation.isPending}
                      className="ml-1 hover:text-destructive"
                      title="Remove badge"
                      type="button"
                      aria-label={`Remove ${userBadge.badge?.name || 'badge'}`}
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No badges yet</p>
          )}
        </div>

        {/* Add Badge */}
        <div className="border-t pt-4">
          <Label className="mb-2 block">Add Badge</Label>
          <div className="flex gap-2">
            <select
              value={selectedBadgeId}
              onChange={(e) => setSelectedBadgeId(e.target.value)}
              disabled={isLoadingAllBadges || availableBadges.length === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a badge...</option>
              {availableBadges.map((badge) => (
                <option key={badge.id} value={badge.id || ''}>
                  {badge.icon ? `${badge.icon} ` : ''}{badge.name || 'Unnamed Badge'}
                </option>
              ))}
            </select>
            <Button
              onClick={() => {
                if (selectedBadgeId) {
                  addBadgeMutation.mutate(selectedBadgeId)
                }
              }}
              disabled={!selectedBadgeId || addBadgeMutation.isPending}
            >
              {addBadgeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
          {availableBadges.length === 0 && !isLoadingAllBadges && (
            <p className="text-sm text-muted-foreground mt-2">All badges have been awarded</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
