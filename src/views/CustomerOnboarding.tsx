'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// CLERK MIGRATION: Updated to use Clerk instead of Supabase Auth
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, CheckCircle2, ArrowLeft, ArrowRight, Sparkles, Heart, Users, Gift } from "lucide-react";
import { updateProfile, uploadFile, getProfile } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

// Step 1: Interests
const InterestsSchema = z.object({
  categories: z.array(z.string()).min(1, "Select at least one category"),
  vendors: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
});

// Step 2: Profile Picture & Bio
const ProfileSchema = z.object({
  avatar_url: z.string().optional(),
  bio: z.string().max(500).optional(),
});

type Interests = z.infer<typeof InterestsSchema>;
type Profile = z.infer<typeof ProfileSchema>;

const categories = [
  "Food & Beverage",
  "Clothing",
  "Electronics",
  "Services",
  "Art & Crafts",
  "Health & Wellness",
  "Home & Garden",
  "Sports & Outdoors",
];

export default function CustomerOnboarding() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const interestsForm = useForm<Interests>({
    resolver: zodResolver(InterestsSchema),
    defaultValues: {
      categories: [],
      vendors: [],
      groups: [],
    },
  });

  const profileForm = useForm<Profile>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      avatar_url: "",
      bio: "",
    },
  });

  // CLERK MIGRATION: Use Clerk user hook
  const { user, loading: authLoading } = useAuth();
  const isLoaded = !authLoading;

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!user) {
      router.push("/auth");
      return;
    }
    
    setUserId(user.id);

    // Check if profile already exists and onboarding is complete
    const checkProfile = async () => {
      try {
        const profile = await getProfile(user.id);
        if (profile && profile.onboarding_completed) {
          // Onboarding already completed, redirect to home
          router.push("/home");
          return;
        }
      } catch (error) {
        // Profile doesn't exist, continue onboarding
        console.log("Profile not found, continuing onboarding");
      } finally {
        setLoading(false);
      }
    };
    
    checkProfile();
  }, [router]);

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
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCategoryToggle = (category: string) => {
    const current = interestsForm.getValues("categories") || [];
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    interestsForm.setValue("categories", updated);
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await interestsForm.trigger();
      if (!isValid) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const isValid = await profileForm.trigger();
      if (!isValid) return;
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;

    setSubmitting(true);
    try {
      let avatarUrl = profileForm.getValues().avatar_url;

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${userId}/avatar.${fileExt}`;
        try {
          avatarUrl = await uploadFile("avatars", fileName, avatarFile);
        } catch (uploadError) {
          console.error("Avatar upload failed:", uploadError);
          // Continue without avatar if upload fails
        }
      }

      // Update profile and mark onboarding as complete
      try {
        const profileData = {
          avatar_url: avatarUrl || null,
          bio: profileForm.getValues().bio || null,
          onboarding_completed: true, // Mark onboarding as done
        };
        
        console.log("Updating profile with:", profileData);
        await updateProfile(userId, profileData);
        console.log("Profile updated successfully");
      } catch (profileError) {
        console.error("Profile update error details:", profileError);
        // Show the actual error message to help debug
        const errorMsg = profileError instanceof Error ? profileError.message : 'Unknown error';
        toast({
          title: "Profile Creation Error",
          description: errorMsg,
          variant: "destructive",
        });
        throw new Error(errorMsg);
      }

      // Award welcome badge and points via API
      try {
        await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            userId,
            awardBadge: true,
            awardPoints: true,
          }),
        });
      } catch (rewardError) {
        // Don't fail onboarding if rewards fail
        console.error("Failed to award welcome rewards:", rewardError);
      }

      toast({
        title: "Welcome to Optimix! 🎉",
        description: "Your profile is ready!",
      });

      router.push("/home");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete onboarding'
      console.error("Customer onboarding error:", error);
      toast({
        title: "Error Creating Profile",
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

  const progress = (currentStep / 4) * 100;
  const steps = [
    { number: 1, title: "Interests", icon: Heart },
    { number: 2, title: "Profile", icon: Users },
    { number: 3, title: "Welcome", icon: Gift },
    { number: 4, title: "Complete", icon: CheckCircle2 },
  ];

  const selectedCategories = interestsForm.watch("categories") || [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-2xl shadow-primary">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-3xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome to Optimix!
            </CardTitle>
            <CardDescription>Let's personalize your experience</CardDescription>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              return (
                <div key={step.number} className="flex flex-col items-center gap-2 flex-1">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? "bg-primary text-white"
                        : isActive
                        ? "bg-primary text-white ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs text-center ${isActive ? "font-semibold" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Interests */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-4 block">Select your interests *</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose categories you're interested in. We'll personalize your feed based on your selections.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {categories.map((category) => {
                    const isSelected = selectedCategories.includes(category);
                    return (
                      <div
                        key={category}
                        onClick={() => handleCategoryToggle(category)}
                        className={`p-4 rounded-lg border-2 transition-all text-left cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox checked={isSelected} onCheckedChange={() => handleCategoryToggle(category)} />
                          <span className="text-sm font-medium">{category}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {interestsForm.formState.errors.categories && (
                  <p className="text-sm text-destructive mt-2">
                    {interestsForm.formState.errors.categories.message}
                  </p>
                )}
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 Tip: You can always update your interests later in your profile settings.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Profile Picture & Bio */}
          {currentStep === 2 && (
            <form className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32 ring-4 ring-primary/20">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="text-3xl">
                    {userId?.[0]?.toUpperCase() || "U"}
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
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Optional: Add a profile picture</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  {...profileForm.register("bio")}
                  placeholder="Tell us a bit about yourself... (optional)"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">You can always update this later</p>
              </div>
            </form>
          )}

          {/* Step 3: Welcome Badge & Credits */}
          {currentStep === 3 && (
            <div className="text-center space-y-6 py-8">
              <div className="mx-auto w-20 h-20 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center">
                <Gift className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Welcome Rewards!</h3>
                <p className="text-muted-foreground mb-6">
                  As a new member, you'll receive:
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-lg">
                    <Badge className="text-lg px-4 py-2">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Welcome Badge
                    </Badge>
                  </div>
                  <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-lg">
                    <span className="text-2xl font-bold text-secondary">50</span>
                    <span className="text-muted-foreground">Starting Credits</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-lg">
                    <span className="text-2xl font-bold text-primary">10</span>
                    <span className="text-muted-foreground">Bonus Points</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-6">
                  Use credits to get discounts and perks. Earn points by engaging with the community!
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 4 && (
            <div className="text-center space-y-6 py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">You're All Set!</h3>
                <p className="text-muted-foreground">
                  Your profile is complete. Start exploring the community, discovering products, and earning rewards!
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep(currentStep - 1);
                } else {
                  router.push("/onboarding");
                }
              }}
              disabled={submitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {currentStep === 1 ? "Back" : "Previous"}
            </Button>

            {currentStep < 4 ? (
              <Button onClick={handleNext} disabled={submitting}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    Get Started
                    <Sparkles className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

