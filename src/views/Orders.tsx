'use client'

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserOrders } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { SkeletonCard } from "@/components/Skeleton";
import { StripePaymentForm } from "@/components/StripePaymentForm";
import { isStripeConfigured } from "@/lib/stripe-config";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  paid: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  refunded: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  canceled: "bg-red-500/10 text-red-600 border-red-500/20",
};

interface PendingPayment {
  order_id: string;
  client_secret: string;
  stripe_payment_intent?: string;
}

function readPendingPayments(): PendingPayment[] {
  if (typeof window === "undefined") return [];
  const items: PendingPayment[] = [];

  const single = sessionStorage.getItem("payment_intent");
  if (single) {
    try {
      const parsed = JSON.parse(single) as PendingPayment;
      if (parsed.client_secret) items.push(parsed);
    } catch {
      sessionStorage.removeItem("payment_intent");
    }
  }

  const multi = sessionStorage.getItem("payment_intents");
  if (multi) {
    try {
      const parsed = JSON.parse(multi) as PendingPayment[];
      for (const p of parsed) {
        if (p.client_secret && !items.some((i) => i.order_id === p.order_id)) {
          items.push(p);
        }
      }
    } catch {
      sessionStorage.removeItem("payment_intents");
    }
  }

  return items;
}

export default function Orders() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState<string | null>(null);

  useEffect(() => {
    setPendingPayments(readPendingPayments());
  }, []);

  const activePayment = useMemo(
    () => pendingPayments.find((p) => p.order_id === activePaymentOrderId) ?? null,
    [pendingPayments, activePaymentOrderId]
  );

  const { data: orders, isLoading } = useQuery({
    queryKey: ["userOrders", user?.id],
    queryFn: () => getUserOrders(),
    enabled: !!user?.id,
  });

  const filteredOrders = orders?.filter((order) => {
    if (statusFilter === "all") return true;
    return order.status === statusFilter;
  }) || [];

  const clearPaymentForOrder = (orderId: string) => {
    setPendingPayments((prev) => prev.filter((p) => p.order_id !== orderId));
    setActivePaymentOrderId(null);

    const single = sessionStorage.getItem("payment_intent");
    if (single) {
      try {
        const parsed = JSON.parse(single) as PendingPayment;
        if (parsed.order_id === orderId) sessionStorage.removeItem("payment_intent");
      } catch {
        sessionStorage.removeItem("payment_intent");
      }
    }

    const multi = sessionStorage.getItem("payment_intents");
    if (multi) {
      try {
        const parsed = JSON.parse(multi) as PendingPayment[];
        const next = parsed.filter((p) => p.order_id !== orderId);
        if (next.length === 0) {
          sessionStorage.removeItem("payment_intents");
        } else {
          sessionStorage.setItem("payment_intents", JSON.stringify(next));
        }
      } catch {
        sessionStorage.removeItem("payment_intents");
      }
    }

    queryClient.invalidateQueries({ queryKey: ["userOrders"] });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
          <div className="max-w-4xl mx-auto text-center py-12">
            <p className="text-muted-foreground mb-4">Please log in to view your orders</p>
            <Button onClick={() => router.push("/auth")}>Log In</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                My Orders
              </h1>
              <p className="text-muted-foreground">View and manage your orders</p>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pendingPayments.length > 0 && isStripeConfigured() && (
            <Card className="mb-6 border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">Complete payment</CardTitle>
                <CardDescription>
                  {pendingPayments.length === 1
                    ? "You have an unpaid order."
                    : `You have ${pendingPayments.length} orders awaiting payment.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingPayments.length > 1 && !activePayment && (
                  <div className="flex flex-wrap gap-2">
                    {pendingPayments.map((p) => (
                      <Button
                        key={p.order_id}
                        variant="outline"
                        size="sm"
                        onClick={() => setActivePaymentOrderId(p.order_id)}
                      >
                        Pay order #{p.order_id.slice(0, 8)}
                      </Button>
                    ))}
                  </div>
                )}

                {(activePayment || (pendingPayments.length === 1 && pendingPayments[0])) && (
                  <StripePaymentForm
                    clientSecret={(activePayment ?? pendingPayments[0]).client_secret}
                    returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/orders`}
                    submitLabel="Pay order"
                    onSuccess={() => {
                      const paidId = (activePayment ?? pendingPayments[0]).order_id;
                      clearPaymentForOrder(paidId);
                      toast({
                        title: "Payment successful",
                        description: "Your order has been paid.",
                      });
                    }}
                    onError={(message) => {
                      toast({
                        title: "Payment failed",
                        description: message,
                        variant: "destructive",
                      });
                    }}
                  />
                )}

                {activePayment && pendingPayments.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setActivePaymentOrderId(null)}>
                    Choose a different order
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No orders found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {statusFilter === "all"
                    ? "You haven't placed any orders yet."
                    : `You don't have any ${statusFilter} orders.`}
                </p>
                <Button asChild>
                  <Link href="/marketplace">Browse Marketplace</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const needsPayment = pendingPayments.some((p) => p.order_id === order.id);
                return (
                  <Card key={order.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                            <Badge
                              variant="outline"
                              className={statusColors[order.status] || "bg-gray-500/10 text-gray-600"}
                            >
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                            {needsPayment && (
                              <Badge variant="secondary">Payment required</Badge>
                            )}
                          </div>
                          <CardDescription>
                            {formatDistanceToNow(new Date(order.created_at || ""), { addSuffix: true })}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {order.currency === "USD" ? "$" : order.currency}{" "}
                            {Number(order.total).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {order.buyer === user.id ? "Purchase" : "Sale"}
                        </div>
                        <div className="flex gap-2">
                          {needsPayment && isStripeConfigured() && (
                            <Button
                              size="sm"
                              onClick={() => setActivePaymentOrderId(order.id)}
                            >
                              Pay now
                            </Button>
                          )}
                          <Button variant="outline" asChild>
                            <Link href={`/order/${order.id}`}>
                              View Details <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
