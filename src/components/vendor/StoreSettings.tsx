'use client'

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateStoreProfile, uploadFile } from "@/lib/api";
import { Loader2, Upload, Save, Image as ImageIcon, MapPin, Clock, Globe, FileText } from "lucide-react";
import type { Profile } from "@/lib/types";

interface StoreSettingsProps {
  vendorId: string;
  profile: Profile | undefined;
}

export function StoreSettings({ vendorId, profile }: StoreSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [storeName, setStoreName] = useState((profile as any)?.store_name || profile?.display_name || "");
  const [storeDescription, setStoreDescription] = useState((profile as any)?.store_description || profile?.bio || "");
  const [storeLocation, setStoreLocation] = useState((profile as any)?.store_location || "");
  const [storePolicies, setStorePolicies] = useState(
    (profile as any)?.store_policies 
      ? JSON.stringify((profile as any).store_policies, null, 2)
      : JSON.stringify({
          return_policy: "",
          shipping_policy: "",
          refund_policy: "",
        }, null, 2)
  );
  const [storeHours, setStoreHours] = useState(
    (profile as any)?.store_hours
      ? JSON.stringify((profile as any).store_hours, null, 2)
      : JSON.stringify({
          monday: { open: "09:00", close: "17:00", closed: false },
          tuesday: { open: "09:00", close: "17:00", closed: false },
          wednesday: { open: "09:00", close: "17:00", closed: false },
          thursday: { open: "09:00", close: "17:00", closed: false },
          friday: { open: "09:00", close: "17:00", closed: false },
          saturday: { open: "10:00", close: "14:00", closed: false },
          sunday: { closed: true },
        }, null, 2)
  );
  const [socialLinks, setSocialLinks] = useState(
    (profile as any)?.store_social_links
      ? JSON.stringify((profile as any).store_social_links, null, 2)
      : JSON.stringify({
          website: "",
          facebook: "",
          instagram: "",
          twitter: "",
        }, null, 2)
  );

  const updateMutation = useMutation({
    mutationFn: (updates: any) => updateStoreProfile(vendorId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendorProfile", vendorId] });
      toast({
        title: "Store settings updated",
        description: "Your store profile has been updated successfully.",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update store settings';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Banner must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsUploading(true);
    try {
      let bannerUrl = (profile as any)?.store_banner_url;

      // Upload banner if provided
      if (bannerFile) {
        const fileExt = bannerFile.name.split(".").pop();
        const fileName = `${vendorId}/store-banner.${fileExt}`;
        bannerUrl = await uploadFile("store-banners", fileName, bannerFile);
      }

      // Parse JSON fields
      let parsedPolicies = null;
      let parsedHours = null;
      let parsedSocialLinks = null;

      try {
        parsedPolicies = JSON.parse(storePolicies);
      } catch (e) {
        toast({
          title: "Invalid policies JSON",
          description: "Please check your policies format",
          variant: "destructive",
        });
        return;
      }

      try {
        parsedHours = JSON.parse(storeHours);
      } catch (e) {
        toast({
          title: "Invalid hours JSON",
          description: "Please check your store hours format",
          variant: "destructive",
        });
        return;
      }

      try {
        parsedSocialLinks = JSON.parse(socialLinks);
      } catch (e) {
        toast({
          title: "Invalid social links JSON",
          description: "Please check your social links format",
          variant: "destructive",
        });
        return;
      }

      await updateMutation.mutateAsync({
        store_name: storeName,
        store_description: storeDescription,
        store_banner_url: bannerUrl,
        store_location: storeLocation || null,
        store_policies: parsedPolicies,
        store_hours: parsedHours,
        store_social_links: parsedSocialLinks,
      });
    } catch (error) {
      // Error already handled in mutation
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Store Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Store Banner
          </CardTitle>
          <CardDescription>
            Upload a banner image for your store (recommended: 1200x300px)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(bannerPreview || (profile as any)?.store_banner_url) && (
            <div className="relative w-full h-48 rounded-lg overflow-hidden border">
              <img
                src={bannerPreview || (profile as any)?.store_banner_url}
                alt="Store banner"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Label htmlFor="banner" className="cursor-pointer">
              <Button type="button" variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {bannerPreview || (profile as any)?.store_banner_url ? "Change Banner" : "Upload Banner"}
                </span>
              </Button>
            </Label>
            <Input
              id="banner"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerChange}
            />
            {bannerPreview && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBannerFile(null);
                  setBannerPreview(null);
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Store Information */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
          <CardDescription>Basic information about your store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Store Name *</Label>
            <Input
              id="store-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="My Awesome Store"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-description">Store Description</Label>
            <Textarea
              id="store-description"
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              placeholder="Tell customers about your store..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-location">Store Location</Label>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Input
                id="store-location"
                value={storeLocation}
                onChange={(e) => setStoreLocation(e.target.value)}
                placeholder="City, State, Country"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Store Hours
          </CardTitle>
          <CardDescription>Set your store operating hours (JSON format)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="store-hours">Store Hours (JSON)</Label>
            <Textarea
              id="store-hours"
              value={storeHours}
              onChange={(e) => setStoreHours(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Format: {"{"} "monday": {"{"} "open": "09:00", "close": "17:00", "closed": false {"}"} {"}"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Store Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Store Policies
          </CardTitle>
          <CardDescription>Define your return, shipping, and refund policies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="store-policies">Policies (JSON)</Label>
            <Textarea
              id="store-policies"
              value={storePolicies}
              onChange={(e) => setStorePolicies(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Format: {"{"} "return_policy": "...", "shipping_policy": "...", "refund_policy": "..." {"}"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Social Media Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Social Media Links
          </CardTitle>
          <CardDescription>Add links to your social media profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="social-links">Social Links (JSON)</Label>
            <Textarea
              id="social-links"
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Format: {"{"} "website": "...", "facebook": "...", "instagram": "...", "twitter": "..." {"}"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isUploading || updateMutation.isPending}
          size="lg"
        >
          {isUploading || updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Store Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

