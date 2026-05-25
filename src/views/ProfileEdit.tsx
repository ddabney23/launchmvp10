'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Save, ArrowLeft, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile, useUpdateProfile } from "@/hooks/useUserProfile";
import { uploadFile } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SkeletonCard, Skeleton } from "@/components/Skeleton";

const ProfileEditSchema = z.object({
  display_name: z.string().min(1, "Display name is required").max(100).optional(),
  bio: z.string().max(500).optional(),
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
});

type ProfileEditForm = z.infer<typeof ProfileEditSchema>;

interface ProfileEditProps {
  userId?: string;
}

export default function ProfileEdit({ userId }: ProfileEditProps) {
  const router = useRouter();
  // Use userId prop if provided, otherwise try to get from URL (for backward compatibility)
  const id = userId || (typeof window !== 'undefined' ? window.location.pathname.split('/').slice(-2, -1)[0] : '');
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile(id);
  const updateProfileMutation = useUpdateProfile();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<ProfileEditForm>({
    resolver: zodResolver(ProfileEditSchema),
    defaultValues: {
      display_name: "",
      bio: "",
      username: "",
    },
  });

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      form.reset({
        display_name: profile.display_name || "",
        bio: profile.bio || "",
        username: profile.username || "",
      });
      if (profile.avatar_url) {
        setAvatarPreview(profile.avatar_url);
      }
    }
  }, [profile, form]);

  // Check if user is the owner
  const isOwner = user?.id === id;

  useEffect(() => {
    if (!profileLoading && (!isOwner || !profile)) {
      toast({
        title: "Access Denied",
        description: "You can only edit your own profile.",
        variant: "destructive",
      });
      router.push(`/profile/${id}`);
    }
  }, [profileLoading, isOwner, profile, id, router, toast]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const onSubmit = async (data: ProfileEditForm) => {
    if (!id || !user || user.id !== id) {
      toast({
        title: "Error",
        description: "You can only edit your own profile",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      let avatarUrl = profile?.avatar_url || null;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
        avatarUrl = await uploadFile("avatars", fileName, avatarFile);
      } else if (avatarPreview === null && profile?.avatar_url) {
        // Avatar was removed
        avatarUrl = null;
      }

      // Update profile
      await updateProfileMutation.mutateAsync({
        userId: id,
        updates: {
          ...data,
          avatar_url: avatarUrl,
        },
      });

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      router.push(`/profile/${id}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
      toast({
        title: "Error updating profile",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-10 w-32" />
            <SkeletonCard />
          </div>
        </main>
      </div>
    );
  }

  if (!isOwner || !profile) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => router.push(`/profile/${id}`)} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Edit Profile</CardTitle>
              <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Avatar Upload */}
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarPreview || undefined} />
                      <AvatarFallback>
                        {profile.username?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Label htmlFor="avatar-upload" className="cursor-pointer">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload
                            </span>
                          </Button>
                        </Label>
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                        {avatarPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemoveAvatar}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG or GIF. Max size 5MB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    {...form.register("username")}
                    placeholder="username"
                  />
                  {form.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.username.message}
                    </p>
                  )}
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    {...form.register("display_name")}
                    placeholder="Your display name"
                  />
                  {form.formState.errors.display_name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.display_name.message}
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    {...form.register("bio")}
                    placeholder="Tell us about yourself"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.watch("bio")?.length || 0}/500 characters
                  </p>
                  {form.formState.errors.bio && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.bio.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={uploading || updateProfileMutation.isPending}
                    className="flex-1"
                  >
                    {uploading || updateProfileMutation.isPending ? (
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/profile/${id}`)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

