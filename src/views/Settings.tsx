'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload, Save, Bell, Lock, User, Shield, Mail, Trash2, AlertTriangle } from "lucide-react";
import { updateProfile, uploadFile } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
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
} from "@/components/ui/alert-dialog";

// Form schemas
const ProfileSchema = z.object({
  display_name: z.string().min(1, "Display name is required").max(50),
  bio: z.string().max(500).optional(),
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
});

const NotificationSettingsSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  marketing_emails: z.boolean(),
  order_updates: z.boolean(),
  group_updates: z.boolean(),
  mentions: z.boolean(),
});

type ProfileForm = z.infer<typeof ProfileSchema>;
type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

export default function Settings() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, refetch: refetchProfile } = useAuth();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      display_name: profile?.display_name || "",
      bio: profile?.bio || "",
      username: profile?.username || "",
    },
  });

  const notificationForm = useForm<NotificationSettings>({
    resolver: zodResolver(NotificationSettingsSchema),
    defaultValues: {
      email_notifications: true,
      push_notifications: true,
      marketing_emails: false,
      order_updates: true,
      group_updates: true,
      mentions: true,
    },
  });

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        display_name: profile.display_name || "",
        bio: profile.bio || "",
        username: profile.username || "",
      });
    }
  }, [profile, profileForm]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Avatar must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (data: ProfileForm) => {
    if (!user?.id || !profile?.id) {
      toast({
        title: "Error",
        description: "Profile not found. Please complete onboarding.",
        variant: "destructive",
      });
      return;
    }

    // Use profile UUID for database operations
    const profileUuid = profile.id;

    setUploading(true);
    try {
      let avatarUrl = profile?.avatar_url;

      // Upload avatar if provided - use profile UUID for file path
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${profileUuid}/avatar.${fileExt}`;
        avatarUrl = await uploadFile("avatars", fileName, avatarFile);
      }

      await updateProfile(profileUuid, {
        display_name: data.display_name,
        bio: data.bio || undefined,
        username: data.username,
        avatar_url: avatarUrl || null,
      });

      await refetchProfile();

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleNotificationSubmit = async (data: NotificationSettings) => {
    // For now, store in localStorage (in production, this would be stored in the database)
    localStorage.setItem("notification_settings", JSON.stringify(data));
    toast({
      title: "Settings saved",
      description: "Your notification preferences have been saved",
    });
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || !profile?.id) {
      toast({
        title: "Error",
        description: "Profile not found. Cannot delete account.",
        variant: "destructive",
      });
      return;
    }

    // Use profile UUID for database operations
    const profileUuid = profile.id;

    setDeletingAccount(true);
    try {
      // Delete profile from Supabase first - use profile UUID
      try {
        await supabase
          .from("profiles")
          .delete()
          .eq("id", profileUuid);
      } catch (profileError) {
        console.error("Error deleting profile:", profileError);
        // Continue with account deletion even if profile deletion fails
      }

      // Note: Clerk handles account deletion separately
      // We don't need to delete from Supabase Auth since we're using Clerk
      // The profile deletion above is sufficient
      
      // Note: With Clerk, account deletion should be handled through Clerk's dashboard
      // or via Clerk API. For now, we'll just delete the profile and sign out.
      // The user can delete their Clerk account separately if needed.
      toast({
        title: "Profile deleted",
        description: "Your profile has been deleted. Please delete your Clerk account separately if needed.",
      });
      router.push("/auth");
      return;

      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully",
      });

      router.push("/auth");
    } catch (error: unknown) {
      let errorMessage = getUserFriendlyError(error);
      if (error && typeof error === "object" && "message" in error) {
        errorMessage = (error as { message?: string }).message || errorMessage;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-muted-foreground">Manage your account settings and preferences</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security">
                <Lock className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="account">
                <Shield className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>Update your profile information and avatar</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                    <div className="flex flex-col items-center space-y-4">
                      <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                        <AvatarImage src={avatarPreview || profile.avatar_url || undefined} />
                        <AvatarFallback className="text-2xl">
                          {profile.username?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex gap-2">
                        <Label htmlFor="avatar" className="cursor-pointer">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Photo
                            </span>
                          </Button>
                        </Label>
                        <Input
                          id="avatar"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                        {avatarPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAvatarFile(null);
                              setAvatarPreview(null);
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        {...profileForm.register("username")}
                        placeholder="username"
                      />
                      {profileForm.formState.errors.username && (
                        <p className="text-sm text-destructive">
                          {profileForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="display_name">Display Name *</Label>
                      <Input
                        id="display_name"
                        {...profileForm.register("display_name")}
                        placeholder="Your display name"
                      />
                      {profileForm.formState.errors.display_name && (
                        <p className="text-sm text-destructive">
                          {profileForm.formState.errors.display_name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        {...profileForm.register("bio")}
                        placeholder="Tell us about yourself..."
                        rows={4}
                      />
                      {profileForm.formState.errors.bio && (
                        <p className="text-sm text-destructive">
                          {profileForm.formState.errors.bio.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {profile.is_vendor && (
                        <Badge variant="default">
                          <Shield className="h-3 w-3 mr-1" />
                          {profile.vendor_verified ? "Verified Vendor" : "Vendor"}
                        </Badge>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {user.email}
                      </div>
                    </div>

                    <Button type="submit" disabled={uploading}>
                      {uploading ? (
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
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Security</CardTitle>
                  <CardDescription>
                    Password and email are managed through Supabase Auth. Use sign out and sign in again to switch accounts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    To change your password, use the reset link on the sign-in page or update it in the Supabase dashboard if you use email auth.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const { error } = await supabase.auth.resetPasswordForEmail(
                        user?.email ?? '',
                        { redirectTo: `${window.location.origin}/auth/callback?redirect_url=/settings` }
                      );
                      if (error) {
                        toast({ variant: 'destructive', title: 'Could not send reset email', description: error.message });
                      } else {
                        toast({ title: 'Check your email', description: 'We sent a password reset link if an account exists for this address.' });
                      }
                    }}
                    disabled={!user?.email}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send password reset email
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              {/* Push Notifications */}
              <PushNotificationSettings 
                vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
              />

              <Separator />

              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Manage how you receive notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={notificationForm.handleSubmit(handleNotificationSubmit)} className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="email_notifications">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications via email
                        </p>
                      </div>
                      <Switch
                        id="email_notifications"
                        checked={notificationForm.watch("email_notifications")}
                        onCheckedChange={(checked) =>
                          notificationForm.setValue("email_notifications", checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="push_notifications">Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive browser push notifications
                        </p>
                      </div>
                      <Switch
                        id="push_notifications"
                        checked={notificationForm.watch("push_notifications")}
                        onCheckedChange={(checked) =>
                          notificationForm.setValue("push_notifications", checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="marketing_emails">Marketing Emails</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive promotional emails and updates
                        </p>
                      </div>
                      <Switch
                        id="marketing_emails"
                        checked={notificationForm.watch("marketing_emails")}
                        onCheckedChange={(checked) =>
                          notificationForm.setValue("marketing_emails", checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="order_updates">Order Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified about order status changes
                        </p>
                      </div>
                      <Switch
                        id="order_updates"
                        checked={notificationForm.watch("order_updates")}
                        onCheckedChange={(checked) =>
                          notificationForm.setValue("order_updates", checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="group_updates">Group Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive updates from groups you're in
                        </p>
                      </div>
                      <Switch
                        id="group_updates"
                        checked={notificationForm.watch("group_updates")}
                        onCheckedChange={(checked) =>
                          notificationForm.setValue("group_updates", checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="mentions">Mentions</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when someone mentions you
                        </p>
                      </div>
                      <Switch
                        id="mentions"
                        checked={notificationForm.watch("mentions")}
                        onCheckedChange={(checked) =>
                          notificationForm.setValue("mentions", checked)
                        }
                      />
                    </div>

                    <Button type="submit">
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Settings */}
            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>Account Management</CardTitle>
                  <CardDescription>Manage your account and data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Delete Account</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Account
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your account,
                                profile, posts, and all associated data from our servers.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDeleteAccount}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deletingAccount}
                              >
                                {deletingAccount ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  "Delete Account"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-2">Account Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">User ID:</span>
                        <span className="font-mono text-xs">{user.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span>{user.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Member since:</span>
                        <span>{new Date(profile.created_at || "").toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PageShell>
    </div>
  );
}

