'use client'

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Package, MapPin, CreditCard, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getOrder, getOrderItems, getProfile } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { OptimizedImage } from "@/components/OptimizedImage";
import type { Order, OrderItem, Listing } from "@/lib/types";
import { SkeletonCard } from "@/components/Skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  paid: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  refunded: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  canceled: "bg-red-500/10 text-red-600 border-red-500/20",
};

interface OrderDetailProps {
  orderId?: string;
}

export default function OrderDetail({ orderId }: OrderDetailProps) {
  const router = useRouter();
  // Use orderId prop if provided, otherwise try to get from URL (for backward compatibility)
  const id = orderId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '');
  const { user } = useAuth();

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const { data: orderItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["orderItems", id],
    queryFn: () => getOrderItems(id!),
    enabled: !!id,
  });

  const { data: vendorProfile } = useQuery({
    queryKey: ["vendorProfile", order?.vendor],
    queryFn: () => getProfile(order!.vendor!),
    enabled: !!order?.vendor,
  });

  const isLoading = orderLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-10 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="max-w-4xl mx-auto text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Order not found</h2>
            <p className="text-muted-foreground mb-4">The order you're looking for doesn't exist.</p>
            <Button onClick={() => router.push("/orders")}>Back to Orders</Button>
          </div>
        </main>
      </div>
    );
  }

  // Check if user has access to this order
  if (user?.id !== order.buyer && user?.id !== order.vendor) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="max-w-4xl mx-auto text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You don't have permission to view this order.</p>
            <Button onClick={() => router.push("/orders")}>Back to Orders</Button>
          </div>
        </main>
      </div>
    );
  }

  const shippingInfo = order.metadata?.shipping_info as
    | {
        firstName?: string;
        lastName?: string;
        email?: string;
        address?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
      }
    | undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => router.push("/orders")} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>

          <div className="space-y-6">
            {/* Order Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">Order #{order.id.slice(0, 8)}</CardTitle>
                    <CardDescription>
                      Placed {formatDistanceToNow(new Date(order.created_at || ""), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusColors[order.status] || "bg-gray-500/10 text-gray-600"}
                  >
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderItems && orderItems.length > 0 ? (
                  <div className="space-y-4">
                    {orderItems.map((item) => {
                      const listing = item.listing as Listing | undefined;
                      return (
                        <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                          {listing?.images?.[0] ? (
                            <OptimizedImage
                              src={listing.images[0]}
                              alt={listing.title}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1">
                            {listing ? (
                              <Link
                                 href={`/listing/${listing.id}`}
                                className="font-semibold hover:underline block mb-1"
                              >
                                {listing.title}
                              </Link>
                            ) : (
                              <p className="font-semibold mb-1">Item (No longer available)</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Quantity: {item.quantity} × {order.currency === "USD" ? "$" : order.currency}{" "}
                              {item.price.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {order.currency === "USD" ? "$" : order.currency}{" "}
                              {(item.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No items found</p>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shipping Information */}
              {shippingInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">
                        {shippingInfo.firstName} {shippingInfo.lastName}
                      </p>
                      <p>{shippingInfo.address}</p>
                      <p>
                        {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}
                      </p>
                      <p>{shippingInfo.country}</p>
                      {shippingInfo.email && (
                        <p className="text-muted-foreground mt-2">{shippingInfo.email}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{order.currency === "USD" ? "$" : order.currency} {order.total.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>
                        {order.currency === "USD" ? "$" : order.currency} {order.total.toFixed(2)}
                      </span>
                    </div>
                    {order.stripe_payment_intent && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Payment ID: {order.stripe_payment_intent.slice(0, 20)}...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Vendor Information */}
            {vendorProfile && (
              <Card>
                <CardHeader>
                  <CardTitle>Vendor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link
                         href={`/profile/${vendorProfile.id}`}
                        className="font-semibold hover:underline"
                      >
                        {vendorProfile.display_name || vendorProfile.username}
                      </Link>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/messages?user=${vendorProfile.id}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contact Vendor
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {order.status === "pending" && user?.id === order.buyer && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    This order is pending payment. Please complete the payment to proceed.
                  </p>
                  <Button variant="outline" disabled>
                    Cancel Order (Coming Soon)
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

