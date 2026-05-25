'use client'

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, MoreVertical, Edit, Trash2, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title: string;
    content: string;
    images?: string[];
    verified_purchase: boolean;
    helpful_count?: number;
    created_at: string;
    updated_at?: string;
    profile: {
      id: string;
      username: string;
      full_name?: string;
      avatar_url?: string;
    };
  };
  currentUserId?: string;
  onEdit?: (reviewId: string) => void;
  onDelete?: (reviewId: string) => void;
}

export function ReviewCard({ review, currentUserId, onEdit, onDelete }: ReviewCardProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count || 0);
  const [hasMarkedHelpful, setHasMarkedHelpful] = useState(false);

  const isOwnReview = currentUserId === review.profile.id;
  const wasUpdated = review.updated_at && review.updated_at !== review.created_at;

  const handleMarkHelpful = async () => {
    if (hasMarkedHelpful) return;

    setHelpfulCount(prev => prev + 1);
    setHasMarkedHelpful(true);

    // TODO: Call API to mark review as helpful
    toast({
      title: "Thanks for your feedback!",
      description: "Your vote has been recorded.",
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/reviews/${review.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete review');
      }

      toast({
        title: "Review deleted",
        description: "Your review has been removed.",
      });

      onDelete(review.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={review.profile.avatar_url || undefined} />
              <AvatarFallback>
                {review.profile.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">
                {review.profile.full_name || review.profile.username}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= review.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </span>
                {wasUpdated && (
                  <span className="text-xs text-muted-foreground">(edited)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {review.verified_purchase && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verified Purchase
              </Badge>
            )}
            {isOwnReview && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(review.id)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <h4 className="font-semibold mb-1">{review.title}</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {review.content}
          </p>
        </div>

        {review.images && review.images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {review.images.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`Review image ${index + 1}`}
                className="w-full h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkHelpful}
            disabled={hasMarkedHelpful || isOwnReview}
            className="gap-2"
          >
            <ThumbsUp className={`h-4 w-4 ${hasMarkedHelpful ? 'fill-current' : ''}`} />
            Helpful ({helpfulCount})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}



