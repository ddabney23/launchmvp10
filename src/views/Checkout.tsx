'use client'

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, CreditCard } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createPaymentIntent, getProfile } from "@/lib/api";
import {
  getStripePublishableKey,
  isStripeConfigured,
  stripeConfigErrorMessage,
} from "@/lib/stripe-config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const checkoutSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().min(1, "Country is required"),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { items, getTotal, clearCart } = useCart();
  const [processing, setProcessing] = useState(false);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: user?.email || "",
      firstName: "",
      lastName: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "US",
    },
  });

  // Group cart items by vendor
  const vendorGroups = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach(item => {
      const vendorId = item.listing?.vendor;
      if (vendorId) {
        if (!groups[vendorId]) {
          groups[vendorId] = [];
        }
        groups[vendorId].push(item);
      }
    });
    return groups;
  }, [items]);

  // Fetch vendor profiles for display
  const { data: vendorProfiles } = useQuery({
    queryKey: ["vendorProfiles", Object.keys(vendorGroups)],
    queryFn: async () => {
      const vendorIds = Object.keys(vendorGroups);
      if (vendorIds.length === 0) return {};
      
      const profiles: Record<string, { display_name?: string; username?: string }> = {};
      
      // Fetch profiles in parallel
      await Promise.all(
        vendorIds.map(async (vendorId) => {
          try {
            const profile = await getProfile(vendorId);
            profiles[vendorId] = {
              display_name: profile.display_name,
              username: profile.username,
            };
          } catch (error) {
            // If profile fetch fails, use vendor ID as fallback
            profiles[vendorId] = { username: vendorId.substring(0, 8) };
          }
        })
      );
      
      return profiles;
    },
    enabled: Object.keys(vendorGroups).length > 0,
  });

  const vendorCount = Object.keys(vendorGroups).length;
  const isMultiVendor = vendorCount > 1;

  // Create order mutation - handles multi-vendor carts
  const createOrderMutation = useMutation({
    mutationFn: async (formData: CheckoutForm) => {
      // If multi-vendor, create separate orders per vendor
      if (isMultiVendor) {
        const orderPromises = Object.entries(vendorGroups).map(async ([vendorId, vendorItems]) => {
          const orderItems = vendorItems.map(item => ({
            listing_id: item.listing_id,
            quantity: item.quantity,
          }));

          return createPaymentIntent(orderItems, {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            country: formData.country,
          });
        });

        const results = await Promise.all(orderPromises);
        return {
          orders: results,
          isMultiVendor: true,
        };
      } else {
        // Single vendor - use existing flow
        const orderItems = items.map(item => ({
          listing_id: item.listing_id,
          quantity: item.quantity,
        }));

        const result = await createPaymentIntent(orderItems, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        });

        return {
          orders: [result],
          isMultiVendor: false,
        };
      }
    },
    onSuccess: async (data) => {
      // Check if Stripe is configured
      const stripeKey = getStripePublishableKey();
      
      if (data.isMultiVendor && data.orders.length > 1) {
        // Multi-vendor order
        toast({
          title: "Orders Created",
          description: `${data.orders.length} orders created (one per vendor). Payment intents ready.`,
        });
        
        // Store all payment intents
        sessionStorage.setItem("payment_intents", JSON.stringify(
          data.orders.map((order: any) => ({
            order_id: order.order_id,
            client_secret: order.client_secret,
            stripe_payment_intent: order.stripe_payment_intent || order.payment_intent_id,
          }))
        ));
        
        setTimeout(() => {
          clearCart();
          router.push(`/orders`);
        }, 2000);
      } else if (data.orders.length > 0) {
        // Single vendor order
        const order = data.orders[0];
        if (stripeKey && order.client_secret) {
          toast({
            title: "Order Created",
            description: `Order #${order.order_id} created. Payment intent ready. Redirecting to payment...`,
          });
          
          sessionStorage.setItem("payment_intent", JSON.stringify({
            order_id: order.order_id,
            client_secret: order.client_secret,
            stripe_payment_intent: order.stripe_payment_intent || order.payment_intent_id,
          }));
          
          setTimeout(() => {
            clearCart();
            router.push(`/orders`);
          }, 2000);
        } else {
          toast({
            title: "Order Created",
            description: `Order #${order.order_id} created successfully. Payment processing will be handled separately.`,
          });
          clearCart();
          router.push(`/orders`);
        }
      }
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process order'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setProcessing(false);
    },
  });

  const onSubmit = async (data: CheckoutForm) => {
    if (!user) {
      toast({ title: "Please log in to checkout", variant: "destructive" });
      router.push("/auth");
      return;
    }

    if (items.length === 0) {
      toast({ title: "Your cart is empty", variant: "destructive" });
      router.push("/cart");
      return;
    }

    if (!isStripeConfigured()) {
      toast({
        title: "Payments not configured",
        description: stripeConfigErrorMessage(),
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    createOrderMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground mb-4">Please log in to checkout</p>
              <Button onClick={() => router.push("/auth")}>Log In</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground mb-4">Your cart is empty</p>
              <Button onClick={() => router.push("/cart")}>Go to Cart</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => router.push("/cart")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Checkout
            </h1>
          </div>

          {!isStripeConfigured() && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Payments not configured</AlertTitle>
              <AlertDescription>{stripeConfigErrorMessage()}</AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {/* Checkout Form */}
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input id="firstName" {...form.register("firstName")} />
                        {form.formState.errors.firstName && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input id="lastName" {...form.register("lastName")} />
                        {form.formState.errors.lastName && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" {...form.register("email")} />
                      {form.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address *</Label>
                      <Input id="address" {...form.register("address")} />
                      {form.formState.errors.address && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.address.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input id="city" {...form.register("city")} />
                        {form.formState.errors.city && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.city.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input id="state" {...form.register("state")} />
                        {form.formState.errors.state && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.state.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zipCode">ZIP Code *</Label>
                        <Input id="zipCode" {...form.register("zipCode")} />
                        {form.formState.errors.zipCode && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.zipCode.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Input id="country" {...form.register("country")} />
                      {form.formState.errors.country && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.country.message}
                        </p>
                      )}
                    </div>

                    {/* Payment Section - Placeholder for Stripe */}
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Payment
                      </h3>
                      <Card className="bg-muted">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Payment processing will be handled securely via Stripe.
                            You will be redirected to complete payment.
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                      disabled={
                        processing ||
                        createOrderMutation.isPending ||
                        !isStripeConfigured()
                      }
                    >
                      {(processing || createOrderMutation.isPending) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Place Order
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="md:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                  {isMultiVendor && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {vendorCount} {vendorCount === 1 ? 'vendor' : 'vendors'} • Separate orders will be created
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Vendor Breakdown (if multi-vendor) */}
                  {isMultiVendor && (
                    <>
                      {Object.entries(vendorGroups).map(([vendorId, vendorItems]) => {
                        const vendorTotal = vendorItems.reduce((sum, item) => {
                          return sum + (Number(item.listing?.price || 0) * item.quantity);
                        }, 0);
                        return (
                          <div key={vendorId} className="border rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {vendorProfiles?.[vendorId]?.display_name || vendorProfiles?.[vendorId]?.username || 'Vendor'}
                            </p>
                            {vendorItems.map((item) => {
                              if (!item.listing) return null;
                              return (
                                <div key={item.listing_id} className="flex gap-2 text-xs">
                                  <span className="flex-1 line-clamp-1">{item.listing.title}</span>
                                  <span className="text-muted-foreground">x{item.quantity}</span>
                                  <span>${(Number(item.listing.price) * item.quantity).toFixed(2)}</span>
                                </div>
                              );
                            })}
                            <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                              <span>Subtotal</span>
                              <span>${vendorTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                      <Separator />
                    </>
                  )}

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {items.map((item) => {
                      if (!item.listing) return null;
                      return (
                        <div key={item.listing_id} className="flex gap-3">
                          <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                            {item.listing.images && item.listing.images.length > 0 ? (
                              <img
                                src={item.listing.images[0]}
                                alt={item.listing.title}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1">
                              {item.listing.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity}
                            </p>
                            <p className="text-sm font-semibold">
                              ${(Number(item.listing.price) * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${getTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>TBD</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>TBD</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${getTotal().toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

