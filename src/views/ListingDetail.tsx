'use client'

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerifiedVendorBadge } from "@/components/VerifiedVendorBadge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, ShoppingCart, MapPin, Calendar, Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { getListing, getProfile, isLiked, getLikeCount, like, unlike, getListingAvailability } from "@/lib/api";
import { createBooking } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

interface ListingDetailProps {
  listingId?: string;
}

export default function ListingDetail({ listingId }: ListingDetailProps) {
  const router = useRouter();
  // Use listingId prop if provided, otherwise try to get from URL (for backward compatibility)
  const id = listingId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '');
  const { toast } = useToast();
  const { user } = useAuth();
  const { addItem } = useCart();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState<Date | undefined>();
  const [bookingStartTime, setBookingStartTime] = useState("");
  const [bookingEndTime, setBookingEndTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<Array<{ start: string; end: string; available: boolean }>>([]);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => {
      if (!id) throw new Error("Listing ID required");
      return getListing(id);
    },
    enabled: !!id,
  });

  const { data: vendorProfile } = useQuery({
    queryKey: ["profile", listing?.vendor],
    queryFn: () => {
      if (!listing?.vendor) throw new Error("Vendor ID required");
      return getProfile(listing.vendor);
    },
    enabled: !!listing?.vendor,
  });

  const { data: isLikedData } = useQuery({
    queryKey: ["isLiked", "listing", id, user?.id],
    queryFn: () => {
      if (!user?.id || !id) return false;
      return isLiked("listing", id);
    },
    enabled: !!user?.id && !!id,
  });

  const { data: likesCount } = useQuery({
    queryKey: ["likeCount", "listing", id],
    queryFn: () => {
      if (!id) return 0;
      return getLikeCount("listing", id);
    },
    enabled: !!id,
  });

  const likeMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Listing ID required");
      return like("listing", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isLiked", "listing", id] });
      queryClient.invalidateQueries({ queryKey: ["likeCount", "listing", id] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Listing ID required");
      return unlike("listing", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isLiked", "listing", id] });
      queryClient.invalidateQueries({ queryKey: ["likeCount", "listing", id] });
    },
  });

  // Fetch availability when dialog opens or date changes
  const { data: availability, isLoading: availabilityLoadingQuery } = useQuery({
    queryKey: ["listingAvailability", id, bookingDate],
    queryFn: () => {
      if (!id) throw new Error("Listing ID required");
      const dateStr = bookingDate ? bookingDate.toISOString().split('T')[0] : undefined;
      return getListingAvailability(id, dateStr, 30);
    },
    enabled: !!id && bookingDialogOpen,
  });

  // Update available time slots when date or availability changes
  useEffect(() => {
    if (bookingDate && availability) {
      const dateStr = bookingDate.toISOString().split('T')[0];
      const dayAvailability = availability.availability.find(day => day.date === dateStr);
      if (dayAvailability) {
        setAvailableTimeSlots(dayAvailability.timeSlots);
      } else {
        setAvailableTimeSlots([]);
      }
    } else {
      setAvailableTimeSlots([]);
    }
  }, [bookingDate, availability]);

  const bookingMutation = useMutation({
    mutationFn: () => {
      if (!id || !listing || !bookingDate || !bookingStartTime || !bookingEndTime) {
        throw new Error("Missing booking information");
      }

      const startTime = new Date(bookingDate);
      const [startHours, startMinutes] = bookingStartTime.split(":").map(Number);
      startTime.setHours(startHours, startMinutes, 0, 0);

      const endTime = new Date(bookingDate);
      const [endHours, endMinutes] = bookingEndTime.split(":").map(Number);
      endTime.setHours(endHours, endMinutes, 0, 0);

      return createBooking({
        listing_id: id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: bookingNotes || undefined,
        status: "pending"
      });
    },
    onSuccess: () => {
      toast({ title: "Booking requested successfully!" });
      setBookingDialogOpen(false);
      setBookingDate(undefined);
      setBookingStartTime("");
      setBookingEndTime("");
      setBookingNotes("");
      queryClient.invalidateQueries({ queryKey: ["listingAvailability", id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = () => {
    if (!id) return;
    addItem(id, quantity);
  };

  const handleLike = () => {
    if (!user) {
      toast({ title: "Please log in to like listings", variant: "destructive" });
      return;
    }

    if (isLikedData) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const handleBuyNow = () => {
    if (!user) {
      toast({ title: "Please log in to purchase", variant: "destructive" });
      router.push("/auth");
      return;
    }

    router.push("/checkout");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Listing not found</p>
          </div>
        </div>
      </div>
    );
  }

  const maxQuantity = Math.min(listing.quantity, 10);
  const isOwner = user?.id === listing.vendor;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Images */}
            <div className="space-y-4">
              {listing.images && listing.images.length > 0 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {listing.images.map((image, index) => (
                      <CarouselItem key={index}>
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                          <img
                            src={image}
                            alt={`${listing.title} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {listing.images.length > 1 && (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  )}
                </Carousel>
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <ShoppingCart className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h1 className="text-3xl font-bold">{listing.title}</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLike}
                    className={isLikedData ? "text-destructive" : ""}
                  >
                    <Heart className={`h-6 w-6 ${isLikedData ? "fill-current" : ""}`} />
                  </Button>
                </div>

                <div className="flex items-center gap-4 text-muted-foreground mb-4">
                  {listing.category && <Badge variant="secondary">{listing.category}</Badge>}
                  {likesCount !== undefined && likesCount > 0 && (
                    <span className="text-sm">
                      <Heart className="inline h-4 w-4 mr-1" />
                      {likesCount} {likesCount === 1 ? "like" : "likes"}
                    </span>
                  )}
                </div>

                <div className="text-4xl font-bold text-primary mb-4">
                  ${Number(listing.price).toFixed(2)}
                </div>

                {listing.description && (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {listing.description}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Vendor Info */}
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={vendorProfile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {vendorProfile?.username?.[0]?.toUpperCase() || "V"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/profile/${listing.vendor}`}
                      className="font-semibold hover:text-primary transition-colors truncate flex-1 min-w-0"
                    >
                      {vendorProfile?.display_name || vendorProfile?.username || "Vendor"}
                    </Link>
                    {vendorProfile?.vendor_verified && (
                      <VerifiedVendorBadge size="sm" className="flex-shrink-0" />
                    )}
                  </div>
                </div>

                {listing.location && 'city' in listing.location && 'state' in listing.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {listing.location.city as string}, {listing.location.state as string}
                    </span>
                  </div>
                )}
              </Card>

              {/* Purchase Options */}
              {!isOwner && listing.active && (
                <Card className="p-4 space-y-4">
                  {listing.quantity > 0 ? (
                    <>
                      <div className="flex items-center gap-4">
                        <Label htmlFor="quantity">Quantity</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            disabled={quantity <= 1}
                          >
                            -
                          </Button>
                          <Input
                            id="quantity"
                            type="number"
                            min={1}
                            max={maxQuantity}
                            value={quantity}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1));
                              setQuantity(val);
                            }}
                            className="w-20 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                            disabled={quantity >= maxQuantity}
                          >
                            +
                          </Button>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {listing.quantity} available
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={handleAddToCart}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Add to Cart
                        </Button>
                        <Button
                          className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                          onClick={handleBuyNow}
                        >
                          Buy Now
                        </Button>
                      </div>

                      {/* Booking Option */}
                      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full">
                            <Calendar className="mr-2 h-4 w-4" />
                            Request Booking
                          </Button>
                        </DialogTrigger>
                        <DialogContent aria-describedby="booking-request-description">
                          <DialogHeader>
                            <DialogTitle>Request Booking</DialogTitle>
                            <DialogDescription id="booking-request-description">
                              Select a date and time for your booking
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Select Date</Label>
                              <CalendarComponent
                                mode="single"
                                selected={bookingDate}
                                onSelect={setBookingDate}
                                disabled={(date) => {
                                  // Disable past dates
                                  if (date < new Date()) return true;
                                  
                                  // Disable dates with no available slots
                                  if (availability) {
                                    const dateStr = date.toISOString().split('T')[0];
                                    const dayAvailability = availability.availability.find(day => day.date === dateStr);
                                    if (!dayAvailability || dayAvailability.timeSlots.filter(slot => slot.available).length === 0) {
                                      return true;
                                    }
                                  }
                                  
                                  return false;
                                }}
                                className="rounded-md border"
                              />
                              {availability && bookingDate && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {(() => {
                                    const dateStr = bookingDate.toISOString().split('T')[0];
                                    const dayAvailability = availability.availability.find(day => day.date === dateStr);
                                    const availableCount = dayAvailability?.timeSlots.filter(slot => slot.available).length || 0;
                                    return `${availableCount} time slot${availableCount !== 1 ? 's' : ''} available`;
                                  })()}
                                </p>
                              )}
                            </div>
                            
                            {availabilityLoadingQuery && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Loading availability...</span>
                              </div>
                            )}

                            {bookingDate && availableTimeSlots.length > 0 && (
                              <div>
                                <Label>Available Time Slots</Label>
                                <div className="grid grid-cols-3 gap-2 mt-2 max-h-48 overflow-y-auto">
                                  {availableTimeSlots.map((slot, index) => {
                                    const startTime = new Date(slot.start);
                                    const endTime = new Date(slot.end);
                                    const timeStr = `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
                                    
                                    return (
                                      <Button
                                        key={index}
                                        type="button"
                                        variant={slot.available ? "outline" : "secondary"}
                                        disabled={!slot.available}
                                        className={bookingStartTime === startTime.toTimeString().slice(0, 5) ? "border-primary" : ""}
                                        onClick={() => {
                                          if (slot.available) {
                                            setBookingStartTime(startTime.toTimeString().slice(0, 5));
                                            setBookingEndTime(endTime.toTimeString().slice(0, 5));
                                          }
                                        }}
                                      >
                                        {timeStr}
                                      </Button>
                                    );
                                  })}
                                </div>
                                {availableTimeSlots.filter(slot => slot.available).length === 0 && (
                                  <p className="text-sm text-muted-foreground mt-2">No available time slots for this date</p>
                                )}
                              </div>
                            )}

                            {bookingDate && availableTimeSlots.length === 0 && !availabilityLoadingQuery && (
                              <div className="text-sm text-muted-foreground">
                                <p>No time slots available for this date. Please select another date.</p>
                              </div>
                            )}

                            {bookingStartTime && bookingEndTime && (
                              <div className="p-3 bg-muted rounded-md">
                                <p className="text-sm font-medium">Selected Time:</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(`2000-01-01T${bookingStartTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {new Date(`2000-01-01T${bookingEndTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </p>
                              </div>
                            )}
                            <div>
                              <Label htmlFor="notes">Notes (Optional)</Label>
                              <Textarea
                                id="notes"
                                value={bookingNotes}
                                onChange={(e) => setBookingNotes(e.target.value)}
                                rows={3}
                              />
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => bookingMutation.mutate()}
                              disabled={!bookingDate || !bookingStartTime || !bookingEndTime || bookingMutation.isPending}
                            >
                              {bookingMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Requesting...
                                </>
                              ) : (
                                "Request Booking"
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  ) : (
                    <Badge variant="destructive" className="w-full justify-center py-2">
                      Out of Stock
                    </Badge>
                  )}
                </Card>
              )}

              {!listing.active && (
                <Badge variant="secondary" className="w-full justify-center py-2">
                  This listing is no longer active
                </Badge>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

