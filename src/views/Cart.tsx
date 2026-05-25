'use client'

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, Plus, Minus, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { items, removeItem, updateQuantity, clearCart, getTotal, isLoading } = useCart();

  const handleCheckout = () => {
    if (!user) {
      toast({ title: "Please log in to checkout", variant: "destructive" });
      router.push("/auth");
      return;
    }

    if (items.length === 0) {
      toast({ title: "Your cart is empty", variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
            Shopping Cart
          </h1>

          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
                <p className="text-muted-foreground mb-6">Add items to get started</p>
                <Button onClick={() => router.push("/explore")}>
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Cart Items */}
              <div className="md:col-span-2 space-y-4">
                {items.map((item) => {
                  if (!item.listing) return null;

                  return (
                    <Card key={item.listing_id}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* Image */}
                          <Link
                            to={`/listing/${item.listing_id}`}
                            className="flex-shrink-0 w-24 h-24 bg-muted rounded-lg overflow-hidden"
                          >
                            {item.listing.images && item.listing.images.length > 0 ? (
                              <img
                                src={item.listing.images[0]}
                                alt={item.listing.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </Link>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/listing/${item.listing_id}`}
                              className="hover:text-primary transition-colors"
                            >
                              <h3 className="font-semibold text-lg line-clamp-1">
                                {item.listing.title}
                              </h3>
                            </Link>
                            {item.listing.category && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {item.listing.category}
                              </p>
                            )}
                            <p className="text-lg font-bold text-primary mb-3">
                              ${Number(item.listing.price).toFixed(2)}
                            </p>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 border rounded-md">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(item.listing_id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(item.listing_id, item.quantity + 1)}
                                  disabled={item.quantity >= Math.min(item.listing.quantity, 10)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.listing_id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Subtotal */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-lg font-bold">
                              ${(Number(item.listing.price) * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm("Clear all items from cart?")) {
                      clearCart();
                    }
                  }}
                >
                  Clear Cart
                </Button>
              </div>

              {/* Order Summary */}
              <div className="md:col-span-1">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Subtotal ({items.reduce((sum, item) => sum + item.quantity, 0)} items)
                        </span>
                        <span>${getTotal().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>Calculated at checkout</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>${getTotal().toFixed(2)}</span>
                    </div>

                    <Button
                      className="w-full bg-linear-to-r from-primary to-secondary hover:opacity-90"
                      onClick={handleCheckout}
                      disabled={items.length === 0}
                    >
                      Proceed to Checkout
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push("/explore")}
                    >
                      Continue Shopping
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </PageShell>
    </div>
  );
}

