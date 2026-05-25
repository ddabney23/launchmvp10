'use client'

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createListing, updateListing, getListing, uploadFile } from "@/lib/api";
import { ListingCreateSchema, ListingUpdateSchema } from "@/lib/validators";
import type { ListingCreate, ListingUpdate } from "@/lib/types";
import { Loader2, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ListingFormProps {
  listingId?: string;
  onSuccess?: () => void;
}

export function ListingForm({ listingId, onSuccess, onLimitReached }: ListingFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: existingListing } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => {
      if (!listingId) return null;
      return getListing(listingId);
    },
    enabled: !!listingId,
  });

  // Determine default active status: verified vendors can create active listings,
  // unverified vendors can only create inactive listings (for onboarding)
  const isVerified = profile?.vendor_verified ?? false;
  const defaultActive = isVerified;

  const form = useForm<ListingCreate>({
    resolver: zodResolver(listingId ? ListingUpdateSchema : ListingCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      currency: "USD",
      category: "",
      quantity: 0,
      active: defaultActive,
      images: [],
    },
  });

  useEffect(() => {
    if (existingListing) {
      form.reset({
        title: existingListing.title,
        description: existingListing.description || "",
        price: Number(existingListing.price),
        currency: existingListing.currency,
        category: existingListing.category || "",
        quantity: existingListing.quantity,
        active: existingListing.active,
        images: existingListing.images || [],
      });
      setFilePreviews(existingListing.images || []);
    } else {
      // For new listings, set active based on verification status
      form.setValue('active', defaultActive);
    }
  }, [existingListing, form, defaultActive]);

  const createMutation = useMutation({
    mutationFn: (data: ListingCreate) => {
      // Ensure unverified vendors create inactive listings
      const listingData = {
        ...data,
        active: isVerified ? data.active : false,
      };
      return createListing(listingData);
    },
    onSuccess: () => {
      const message = isVerified 
        ? "Listing created successfully! It will appear in the marketplace." 
        : "Listing created! It will be activated and appear in the marketplace once your vendor application is approved.";
      toast({ title: message });
      // Invalidate all listing-related queries to refresh marketplace and dashboard
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "vendor"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "infinite"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "search"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "all"] });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      let errorMessage = 'Failed to create listing';
      let errorCode = '';
      let errorDetails: any = null;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check if error has additional properties
        const errorAny = error as any;
        errorCode = errorAny.code || '';
        errorDetails = errorAny.details || null;
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as any;
        errorMessage = errorObj.message || errorObj.error || errorMessage;
        errorCode = errorObj.code || '';
        errorDetails = errorObj.details || null;
      }
      
      // Handle listing limit reached error with upgrade option
      if (errorCode === 'LISTING_LIMIT_REACHED' || errorMessage.toLowerCase().includes('listing limit') || errorMessage.toLowerCase().includes('limit reached')) {
        const limit = errorDetails?.currentLimit || errorDetails?.limit || errorDetails?.limit || 'your current limit';
        const currentCount = errorDetails?.currentCount || errorDetails?.currentCount;
        const tier = errorDetails?.tier || 'your current tier';
        const countText = currentCount !== undefined ? `${currentCount}/${limit}` : limit;
        const detailsMessage = errorDetails?.message || `You have reached your listing limit (${countText} listings) for the ${tier} tier.`;
        
        toast({
          title: "Listing Limit Reached",
          description: `${detailsMessage} Please upgrade your subscription to create more listings.`,
          variant: "destructive",
          duration: 10000, // Show longer so user can read it
        });
        
        // Call callback if provided (e.g., to navigate to subscription tab)
        if (onLimitReached) {
          setTimeout(() => {
            onLimitReached();
          }, 1500); // Wait a bit so user can read the message
        }
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ListingUpdate }) => updateListing(id, data),
    onSuccess: () => {
      toast({ title: "Listing updated successfully! Changes will appear in the marketplace." });
      // Invalidate all listing-related queries to refresh marketplace and dashboard
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      queryClient.invalidateQueries({ queryKey: ["listings", "vendor"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "infinite"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "search"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "all"] });
      onSuccess?.();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = selectedFiles.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Only images are supported",
          variant: "destructive",
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Images must be less than 10MB",
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index - filePreviews.length + files.length));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ListingCreate) => {
    // Check authentication before submitting
    // If we have a user, allow submission (API route will verify authentication)
    // Only block if we don't have a user - don't wait for profile to load
    if (!user) {
      // If still loading, show wait message
      if (authLoading) {
        toast({
          title: "Please wait",
          description: "Authentication is loading. Please try again in a moment.",
          variant: "default",
        });
      } else {
        // If not loading and no user, show sign in message
        toast({
          title: "Authentication required",
          description: "Please sign in to create a listing.",
          variant: "destructive",
        });
      }
      return;
    }
    
    // If we have a user, proceed with submission
    // The API route will handle authentication verification
    // We don't need to wait for profile to load - user.id is sufficient

    setIsUploading(true);

    try {
      const imageUrls: string[] = [];

      // Upload new files
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const url = await uploadFile("listings", fileName, file);
        imageUrls.push(url);
      }

      // Combine existing and new images
      const allImages = [...(existingListing?.images || []).filter((img) => filePreviews.includes(img)), ...imageUrls];

      const listingData = {
        ...data,
        images: allImages,
      };

      if (listingId) {
        updateMutation.mutate({ id: listingId, data: listingData });
      } else {
        createMutation.mutate(listingData);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save listing'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...form.register("title")} />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} {...form.register("description")} />
        {form.formState.errors.description && (
          <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            {...form.register("price", { valueAsNumber: true })}
          />
          {form.formState.errors.price && (
            <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity *</Label>
          <Input
            id="quantity"
            type="number"
            min="0"
            {...form.register("quantity", { valueAsNumber: true })}
          />
          {form.formState.errors.quantity && (
            <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={form.watch("category") || ""}
          onValueChange={(value) => form.setValue("category", value)}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
            <SelectItem value="Clothing">Clothing</SelectItem>
            <SelectItem value="Electronics">Electronics</SelectItem>
            <SelectItem value="Services">Services</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Images ({filePreviews.length}/10)</Label>
        {filePreviews.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            {filePreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <Label htmlFor="images" className="cursor-pointer">
            <span className="text-sm text-muted-foreground">Click to upload images</span>
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </Label>
          <p className="text-xs text-muted-foreground mt-2">Max 10 images, 10MB each</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="active"
            checked={form.watch("active")}
            onCheckedChange={(checked) => {
              if (isVerified) {
                form.setValue("active", checked);
              } else {
                // Prevent unverified vendors from activating listings
                form.setValue("active", false);
                toast({
                  title: "Verification Required",
                  description: "You must be a verified vendor to create active listings. Your listing will be activated once your vendor application is approved.",
                  variant: "default",
                });
              }
            }}
            disabled={!isVerified && !listingId}
          />
          <Label htmlFor="active" className="cursor-pointer">
            Active (visible to buyers)
          </Label>
        </div>
        {!isVerified && !listingId && (
          <p className="text-sm text-muted-foreground">
            ⚠️ Your listing will be created as inactive. It will be activated automatically once your vendor application is approved.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={isUploading || createMutation.isPending || updateMutation.isPending}
        >
          {(isUploading || createMutation.isPending || updateMutation.isPending) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUploading ? "Uploading..." : "Saving..."}
            </>
          ) : listingId ? (
            "Update Listing"
          ) : (
            "Create Listing"
          )}
        </Button>
      </div>
    </form>
  );
}

