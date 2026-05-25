'use client'

import { Heart, MapPin, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, isLiked, getLikeCount, like, unlike } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Listing } from "@/lib/types";

interface ListingCardProps {
  listing: Listing;
  currentUserId?: string;
  onAddToCart?: (listingId: string) => void;
}

export const ListingCard = ({ listing, currentUserId, onAddToCart }: ListingCardProps) => {
  const { addItem } = useCart();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const { data: vendorProfile } = useQuery({
    queryKey: ["profile", listing.vendor],
    queryFn: () => getProfile(listing.vendor),
    enabled: !!listing.vendor,
  });

  const { data: isLikedData } = useQuery({
    queryKey: ["isLiked", "listing", listing.id, currentUserId],
    queryFn: () => {
      if (!currentUserId) return false;
      return isLiked("listing", listing.id);
    },
    enabled: !!currentUserId,
  });

  const { data: likesCount } = useQuery({
    queryKey: ["likeCount", "listing", listing.id],
    queryFn: () => getLikeCount("listing", listing.id),
  });

  const likeMutation = useMutation({
    mutationFn: () => like("listing", listing.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isLiked", "listing", listing.id, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["likeCount", "listing", listing.id] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to like listing'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => unlike("listing", listing.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isLiked", "listing", listing.id, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["likeCount", "listing", listing.id] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unlike listing'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUserId) {
      toast({
        title: "Please log in",
        description: "You need to log in to like listings",
        variant: "destructive",
      });
      return;
    }

    if (isLikedData) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const primaryImage = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  const hasLocation = listing.location && (listing.location as any)?.city;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on a link or button
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) {
      return;
    }
    router.push(`/listing/${listing.id}`);
  };

  return (
    <Card 
      className="overflow-hidden shadow-card hover:shadow-hover transition-all duration-300 group cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted overflow-hidden">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Like Button */}
          {currentUserId && (
            <div className="absolute top-2 right-2">
              <Button
                variant="secondary"
                size="icon"
                className={`h-8 w-8 ${isLikedData ? "text-destructive" : ""}`}
                onClick={handleLikeToggle}
                disabled={likeMutation.isPending || unlikeMutation.isPending}
              >
                <Heart className={`h-4 w-4 ${isLikedData ? "fill-current" : ""}`} />
              </Button>
            </div>
          )}

          {/* Category Badge */}
          {listing.category && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary">{listing.category}</Badge>
            </div>
          )}

          {/* Out of Stock Overlay */}
          {listing.quantity === 0 && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="destructive" className="text-lg px-4 py-2">
                Out of Stock
              </Badge>
            </div>
          )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
              {listing.title}
            </h3>
            {listing.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {listing.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">
                ${Number(listing.price).toFixed(2)}
              </p>
              {listing.quantity > 0 && (
                <p className="text-xs text-muted-foreground">
                  {listing.quantity} in stock
                </p>
              )}
            </div>
          </div>

          {/* Vendor & Location */}
          <div className="flex items-center justify-between pt-2 border-t">
            {listing.vendor ? (
              <Link
                href={`/store/${listing.vendor}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={vendorProfile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {vendorProfile?.username?.[0]?.toUpperCase() || "V"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {vendorProfile?.display_name || vendorProfile?.username || "Vendor"}
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={vendorProfile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {vendorProfile?.username?.[0]?.toUpperCase() || "V"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {vendorProfile?.display_name || vendorProfile?.username || "Vendor"}
                </span>
              </div>
            )}

            {hasLocation && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{(listing.location as any).city}</span>
              </div>
            )}
          </div>

          {/* Likes Count */}
          {likesCount !== undefined && likesCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              <span>{likesCount} {likesCount === 1 ? "like" : "likes"}</span>
            </div>
          )}
      </div>

      {/* Quick Add to Cart (if on listing grid) */}
      {listing.active && listing.quantity > 0 && (
        <div className="px-4 pb-4">
          <Button
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onAddToCart) {
                onAddToCart(listing.id);
              } else {
                addItem(listing.id, 1);
              }
            }}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </div>
      )}
    </Card>
  );
};

