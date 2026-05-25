'use client'

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, X, Image as ImageIcon } from "lucide-react";
import { PostCreateSchema } from "@/lib/validators";
import { createPost, uploadFile } from "@/lib/api";
import type { PostCreate } from "@/lib/types";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";

interface FileWithPreview extends File {
  preview?: string;
}

export default function CreatePost() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<PostCreate & { visibility: "public" | "private" | "followers" }>({
    resolver: zodResolver(PostCreateSchema.extend({ visibility: PostCreateSchema.shape.visibility })),
    defaultValues: {
      content: "",
      media_urls: [],
      visibility: "public",
    },
  });

  const createPostMutation = useMutation({
    mutationFn: createPost,
    onSuccess: (newPost) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      
      // Optimistic update - add post immediately to feed cache
      queryClient.setQueryData(["feed"], (old: { pages: Post[][] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: [[newPost, ...(old.pages[0] || [])], ...old.pages.slice(1)]
        };
      });
      
      toast({ title: "Post created successfully!" });
      router.push("/home");
    },
    onError: (error: unknown) => {
      const errorMessage = getUserFriendlyError(error);
      // Provide more specific error messages
      let title = "Error creating post";
      let description = errorMessage;

      if (errorMessage.includes("Not authenticated") || errorMessage.includes("UNAUTHENTICATED")) {
        title = "Authentication required";
        description = "Please sign in to create a post.";
      } else if (errorMessage.includes("Profile not found") || errorMessage.includes("PROFILE_NOT_FOUND")) {
        title = "Profile incomplete";
        description = "Please complete your profile before creating posts.";
      } else if (errorMessage.includes("Permission denied") || errorMessage.includes("PERMISSION_DENIED")) {
        title = "Permission denied";
        description = "Please ensure your email is confirmed and your profile is complete. If the issue persists, try signing out and back in.";
      } else if (errorMessage.includes("email not confirmed") || errorMessage.includes("Email not confirmed")) {
        title = "Email not confirmed";
        description = "Please confirm your email address before creating posts.";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = selectedFiles
      .filter((file) => {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          toast({
            title: "Invalid file type",
            description: "Only images and videos are supported",
            variant: "destructive",
          });
          return false;
        }
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Files must be less than 50MB",
            variant: "destructive",
          });
          return false;
        }
        return true;
      })
      .map((file) => {
        const fileWithPreview = Object.assign(file, { preview: URL.createObjectURL(file) });
        return fileWithPreview;
      });

    setFiles((prev) => [...prev, ...newFiles].slice(0, 10)); // Max 10 files
  };

  const handleRemoveFile = (index: number) => {
    const file = files[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (data: PostCreate & { visibility: "public" | "private" | "followers" }) => {
    if (files.length === 0 && !data.content.trim()) {
      toast({
        title: "Validation error",
        description: "Please add content or media to your post",
        variant: "destructive",
      });
      return;
    }

    // Check if user has a complete profile before attempting to post
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to create a post.",
        variant: "destructive",
      });
      return;
    }

    // Ensure profile exists and is complete
    if (!profile || (!profile.username && !profile.display_name)) {
      toast({
        title: "Profile incomplete",
        description: "Please complete your profile before creating posts. Redirecting to onboarding...",
        variant: "destructive",
      });
      setTimeout(() => router.push("/onboarding"), 2000);
      return;
    }

    // Ensure we have profile UUID (not Clerk ID)
    if (!profile.id) {
      toast({
        title: "Error",
        description: "Profile ID not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const mediaUrls: string[] = [];

      // Upload all files with individual error handling
      for (const file of files) {
        try {
          const fileExt = file.name.split(".").pop();
          if (!fileExt) {
            throw new Error(`Invalid file extension for ${file.name}`);
          }
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const url = await uploadFile("posts", fileName, file);
          mediaUrls.push(url);
        } catch (uploadError) {
          logger.error('File upload failed', uploadError, { fileName: file.name });
          setIsUploading(false);
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}. ${uploadError instanceof Error ? uploadError.message : 'Please try again.'}`,
            variant: "destructive",
          });
          return; // Stop post creation if upload fails
        }
      }

      // Create post
      await createPostMutation.mutateAsync({
        content: data.content,
        media_urls: mediaUrls,
        visibility: data.visibility,
      });
    } catch (error: unknown) {
      // Error already handled in mutation, but log for debugging
      logger.error("Post creation error", error);
    } finally {
      setIsUploading(false);
      // Clean up preview URLs
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <Card className="max-w-2xl mx-auto shadow-card animate-scale-in">
          <CardHeader>
            <CardTitle className="text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Create New Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="What's on your mind?"
                  rows={4}
                  {...form.register("content")}
                />
                {form.formState.errors.content && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.content.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Media ({files.length}/10)</Label>
                {files.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {files.map((file, index) => (
                      <div key={index} className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                        {file.type.startsWith("video/") ? (
                          <video src={file.preview} className="w-full h-full object-cover" />
                        ) : (
                          <img src={file.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square bg-muted rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center transition-colors"
                >
                  <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center px-4">
                    Click to upload images or videos
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Max 10 files, 50MB each
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={form.watch("visibility")}
                  onValueChange={(value: "public" | "private" | "followers") =>
                    form.setValue("visibility", value)
                  }
                >
                  <SelectTrigger id="visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="followers">Followers Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                disabled={isUploading || createPostMutation.isPending}
              >
                {isUploading || createPostMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploading ? "Uploading..." : "Creating..."}
                  </>
                ) : (
                  "Share Post"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
