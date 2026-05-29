'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { OnboardingSchema, VendorApplicationSchema } from "@/lib/validators";
import { updateProfile } from "@/lib/api";
import { uploadFile } from "@/lib/api";
import type { Onboarding, VendorApplication, ProfileUpdate } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { isClerkId } from "@/lib/user-id-helpers";
import { isOnboardingComplete } from "@/lib/profile-utils";

export default function Onboarding() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading: authLoading, refetch } = useAuth();
  const authUserId = user?.id;
  const authEmail = user?.email;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isVendor, setIsVendor] = useState(false);

  const onboardingForm = useForm<Onboarding>({
    resolver: zodResolver(OnboardingSchema),
    defaultValues: {
      username: "",
      display_name: "",
      bio: "",
      avatar_url: "",
      is_vendor: false,
    },
    mode: "onSubmit", // Only validate on submit, not on change
  });

  const vendorForm = useForm<VendorApplication>({
    resolver: zodResolver(VendorApplicationSchema),
    defaultValues: {
      business_name: "",
      business_id: "",
      category: "",
      address: "",
      city: "",
      state: "",
      country: "",
      phone: "",
      website: "",
    },
  });

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!authUserId) {
      router.push("/auth");
      return;
    }

    // Check if profile already exists - use Clerk ID to query
    const checkProfile = async () => {
      if (!authUserId) {
        setLoading(false);
        return;
      }

      try {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUserId)
          .maybeSingle();

        if (existingProfile) {
          // Profile is complete if onboarding was finished
          if (isOnboardingComplete(existingProfile)) {
            // Onboarding already done, redirect to home
            router.push("/home");
            return;
          }
          // Pre-fill form with existing data
          onboardingForm.reset({
            username: existingProfile.username || "",
            display_name: existingProfile.display_name || "",
            bio: existingProfile.bio || "",
            avatar_url: existingProfile.avatar_url || "",
            is_vendor: existingProfile.is_vendor || false,
          });
          setAvatarPreview(existingProfile.avatar_url || null);
          setIsVendor(existingProfile.is_vendor || false);
        } else {
          // If no profile exists, pre-fill with email-based defaults
          if (authEmail) {
            const emailPrefix = authEmail.split("@")[0];
            onboardingForm.reset({
              username: emailPrefix || "",
              display_name: emailPrefix || "",
              bio: "",
              avatar_url: "",
              is_vendor: false,
            });
          }
        }
      } catch (error) {
        logger.error("Error checking profile", error);
      } finally {
        setLoading(false);
      }
    };

    checkProfile();
  }, [authUserId, authEmail, authLoading, router, onboardingForm]);

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

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Avatar must be an image",
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
  };

  const handleOnboardingSubmit = async (data: Onboarding) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Not authenticated. Please sign in.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let avatarUrl = data.avatar_url;
      const profileId = user.id;

      // Upload avatar if new file selected
      // Use Clerk ID for file path (will be converted to profile UUID after profile creation)
      if (avatarFile) {
        try {
          const fileExt = avatarFile.name.split(".").pop();
          if (!fileExt) {
            throw new Error(`Invalid file extension for ${avatarFile.name}`);
          }
          // Use Clerk ID for file path - will be associated with profile after creation
          const fileName = `${profileId}/avatar.${fileExt}`;
          avatarUrl = await uploadFile("avatars", fileName, avatarFile);
        } catch (uploadError) {
          logger.error('Avatar upload failed', uploadError, { profileId, fileName: avatarFile.name });
          setSubmitting(false);
          toast({
            title: "Upload failed",
            description: `Failed to upload avatar. ${uploadError instanceof Error ? uploadError.message : 'Please try again.'}`,
            variant: "destructive",
          });
          return; // Stop onboarding if upload fails
        }
      }

      // Update profile - use Clerk ID (updateProfile handles the conversion)
      // Ensure we have at least username or display_name
      const profileUpdate: any = {
        username: data.username || data.display_name || "user",
        display_name: data.display_name || data.username || "User",
        bio: data.bio || null,
        avatar_url: avatarUrl || null,
        onboarding_completed: true, // Mark onboarding as done
      };

      // updateProfile accepts Clerk ID and handles the lookup
      await updateProfile(profileId, profileUpdate);
      await refetch();

      toast({
        title: "Profile updated!",
        description: "Your profile has been saved successfully.",
      });

      // For now, redirect directly to home - vendor/customer onboarding can be done later
      // If user wants to become a vendor, they can do it from settings
      router.push("/home");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVendorSubmit = async (data: VendorApplication) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Not authenticated. Please sign in.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Store vendor application data in profile metadata or separate table
      // Query profile by auth user id
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        toast({
          title: "Error",
          description: "Profile not found. Please complete onboarding first.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Update profile using profile UUID
      await supabase
        .from("profiles")
        .update({
          is_vendor: true,
          // Store vendor data in a metadata JSONB field if needed
          // For MVP, we'll just set is_vendor to true
          // Admin can verify later
        })
        .eq("id", existingProfile.id); // Use profile UUID

      toast({
        title: "Application submitted!",
        description: "Your vendor application has been submitted for review.",
      });

      router.push("/home");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit application'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-2xl shadow-primary animate-scale-in">
        <CardHeader className="space-y-4 text-center">
          <div>
            <CardTitle className="text-3xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
              {currentStep === 1 ? "Welcome to Optimix! 🎉" : "Vendor Application"}
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              {currentStep === 1
                ? "Let's set up your profile. This will only take a minute!"
                : "Provide some details about your business"}
            </CardDescription>
          </div>
          {currentStep === 1 && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <span>Quick Setup</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <span>Personalized Experience</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {currentStep === 1 ? (
            <form
              onSubmit={onboardingForm.handleSubmit(handleOnboardingSubmit)}
              className="space-y-6"
            >
              {/* Avatar Upload */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="text-2xl">
                    {onboardingForm.watch("display_name")?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Avatar
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
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">
                  Username *
                  <span className="text-xs text-muted-foreground ml-2">(This will be your unique identifier)</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  {...onboardingForm.register("username")}
                />
                <p className="text-xs text-muted-foreground">
                  Choose a unique username. You can change this later in settings.
                </p>
                {onboardingForm.formState.errors.username && (
                  <p className="text-sm text-destructive">
                    {onboardingForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">
                  Display Name *
                  <span className="text-xs text-muted-foreground ml-2">(How others will see your name)</span>
                </Label>
                <Input
                  id="display_name"
                  type="text"
                  placeholder="John Doe"
                  {...onboardingForm.register("display_name")}
                />
                <p className="text-xs text-muted-foreground">
                  This is your public display name shown on your profile.
                </p>
                {onboardingForm.formState.errors.display_name && (
                  <p className="text-sm text-destructive">
                    {onboardingForm.formState.errors.display_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">
                  Bio
                  <span className="text-xs text-muted-foreground ml-2">(Optional - tell us about yourself)</span>
                </Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself... (e.g., I love exploring new products and supporting local businesses!)"
                  rows={4}
                  {...onboardingForm.register("bio")}
                />
                <p className="text-xs text-muted-foreground">
                  Share a bit about yourself. This helps others connect with you!
                </p>
                {onboardingForm.formState.errors.bio && (
                  <p className="text-sm text-destructive">
                    {onboardingForm.formState.errors.bio.message}
                  </p>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-start space-x-3">
                  <Switch
                    id="is_vendor"
                    checked={isVendor}
                    onCheckedChange={(checked) => {
                      setIsVendor(checked);
                      onboardingForm.setValue("is_vendor", checked);
                    }}
                  />
                  <div className="flex-1">
                    <Label htmlFor="is_vendor" className="cursor-pointer font-medium">
                      I want to become a vendor
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Check this if you want to sell products or services on Optimix. You can always apply later in settings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                  onClick={async () => {
                    // Skip onboarding - create minimal profile and go to home
                    if (!user?.id) {
                      toast({
                        title: "Error",
                        description: "Not authenticated. Please sign in.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setSubmitting(true);
                    try {
                      const emailPrefix = user.email?.split("@")[0] || `user_${Date.now()}`;
                      
                      // Ensure unique username by checking and appending timestamp if needed
                      let username = emailPrefix;
                      let attempts = 0;
                      const maxAttempts = 5;
                      
                      while (attempts < maxAttempts) {
                        const { data: existing } = await supabase
                          .from("profiles")
                          .select("id")
                          .eq("username", username)
                          .maybeSingle();
                        
                        if (!existing) break;
                        
                        // Username exists, try with timestamp
                        username = `${emailPrefix}_${Date.now()}`;
                        attempts++;
                      }
                      
                      // Use upsert directly to ensure profile is created/updated
                      // Upsert profile by auth user id
                      const profileData: any = {
                        id: user.id,
                        username: username,
                        display_name: emailPrefix,
                        bio: null,
                        avatar_url: null,
                        is_vendor: false,
                        onboarding_completed: true, // Mark as done even when skipped
                        created_at: new Date().toISOString(),
                      };

                      // Add email if column exists
                      if (user.email) {
                        profileData.email = user.email;
                      }

                      // Use upsert with better error handling
                      // Upsert by profiles.id (= auth.users.id)
                      const { error: upsertError } = await supabase
                        .from("profiles")
                        .upsert(profileData, {
                          onConflict: "id",
                        });

                      if (upsertError) {
                        // If username conflict, try with different username
                        if (upsertError.code === "23505" || upsertError.message.includes("unique") || upsertError.message.includes("duplicate")) {
                          profileData.username = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                          const { error: retryError } = await supabase
                            .from("profiles")
                            .upsert(profileData, { onConflict: "id" });
                          
                          if (retryError) {
                            throw new Error(retryError.message || "Failed to create profile. Username may already be taken.");
                          }
                        } else {
                          throw new Error(upsertError.message || "Failed to create profile");
                        }
                      }

                      await refetch();

                      toast({
                        title: "Welcome!",
                        description: "You can complete your profile later in settings.",
                      });

                      router.push("/home");
                    } catch (error: unknown) {
                      const errorMessage = error instanceof Error ? error.message : 'Failed to skip onboarding. Please try completing the form instead.'
                      logger.error("Skip onboarding error", error, { userId });
                      toast({
                        title: "Error",
                        description: errorMessage,
                        variant: "destructive",
                      });
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                >
                  Skip for now
                </Button>
                <p className="text-xs text-center text-muted-foreground col-span-2">
                  You can always complete your profile later in settings
                </p>
                <Button
                  type="submit"
                  className="flex-1 bg-linear-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
                </div>
              </div>
            </form>
          ) : (
            <form
              onSubmit={vendorForm.handleSubmit(handleVendorSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business_name">Business Name *</Label>
                  <Input
                    id="business_name"
                    type="text"
                    {...vendorForm.register("business_name")}
                  />
                  {vendorForm.formState.errors.business_name && (
                    <p className="text-sm text-destructive">
                      {vendorForm.formState.errors.business_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    type="text"
                    placeholder="e.g., Food & Beverage"
                    {...vendorForm.register("category")}
                  />
                  {vendorForm.formState.errors.category && (
                    <p className="text-sm text-destructive">
                      {vendorForm.formState.errors.category.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input id="address" type="text" {...vendorForm.register("address")} />
                {vendorForm.formState.errors.address && (
                  <p className="text-sm text-destructive">
                    {vendorForm.formState.errors.address.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" type="text" {...vendorForm.register("city")} />
                  {vendorForm.formState.errors.city && (
                    <p className="text-sm text-destructive">
                      {vendorForm.formState.errors.city.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State/Province *</Label>
                  <Input id="state" type="text" {...vendorForm.register("state")} />
                  {vendorForm.formState.errors.state && (
                    <p className="text-sm text-destructive">
                      {vendorForm.formState.errors.state.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input id="country" type="text" {...vendorForm.register("country")} />
                  {vendorForm.formState.errors.country && (
                    <p className="text-sm text-destructive">
                      {vendorForm.formState.errors.country.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-linear-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

