'use client'

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserOrders, createVendorRefund } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, DollarSign, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface RefundManagementProps {
  vendorId: string;
}

export function RefundManagement({ vendorId }: RefundManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch vendor orders (only paid/completed orders can be refunded)
  const { data: orders, isLoading } = useQuery({
    queryKey: ["vendorOrders", vendorId],
    queryFn: () => getUserOrders(vendorId),
    enabled: !!vendorId,
    select: (data) => data.filter(order => 
      order.vendor === vendorId && 
      (order.status === 'paid' || order.status === 'completed' || order.status === 'partially_refunded')
    ),
  });

  const refundMutation = useMutation({
    mutationFn: ({ orderId, amount, reason }: { orderId: string; amount?: number; reason?: string }) =>
      createVendorRefund(orderId, amount, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendorBalance", vendorId] });
      toast({
        title: "Refund processed",
        description: `Refund of $${data.amount?.toFixed(2)} has been processed successfully.`,
      });
      setIsDialogOpen(false);
      setSelectedOrder(null);
      setRefundAmount("");
      setRefundReason("");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process refund';
      toast({
        title: "Refund failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleRefund = (orderId: string, orderTotal: number) => {
    setSelectedOrder(orderId);
    setRefundAmount(orderTotal.toFixed(2));
    setIsDialogOpen(true);
  };

  const submitRefund = () => {
    if (!selectedOrder) return;

    const amount = refundAmount ? parseFloat(refundAmount) : undefined;
    const order = orders?.find(o => o.id === selectedOrder);

    if (!order) return;

    // Validate amount
    if (amount !== undefined) {
      if (amount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Refund amount must be greater than 0",
          variant: "destructive",
        });
        return;
      }
      if (amount > Number(order.total)) {
        toast({
          title: "Invalid amount",
          description: `Refund amount cannot exceed order total of $${Number(order.total).toFixed(2)}`,
          variant: "destructive",
        });
        return;
      }
    }

    refundMutation.mutate({
      orderId: selectedOrder,
      amount,
      reason: refundReason || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const refundableOrders = orders?.filter(order => 
    order.status === 'paid' || order.status === 'completed'
  ) || [];

  const refundedOrders = orders?.filter(order => 
    order.status === 'refunded' || order.status === 'partially_refunded'
  ) || [];

  return (
    <div className="space-y-6">
      {/* Refundable Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Refundable Orders</CardTitle>
          <CardDescription>
            Orders that can be refunded (paid or completed)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {refundableOrders.length > 0 ? (
            <div className="space-y-4">
              {refundableOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">Order #{order.id.substring(0, 8)}</p>
                      <Badge variant="default">{order.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at || ""), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      Total: ${Number(order.total).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleRefund(order.id, Number(order.total))}
                    disabled={refundMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Issue Refund
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No refundable orders</p>
              <p className="text-sm mt-1">Orders must be paid or completed to be eligible for refunds</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refunded Orders History */}
      {refundedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Refund History</CardTitle>
            <CardDescription>Orders that have been refunded</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {refundedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">Order #{order.id.substring(0, 8)}</p>
                      <Badge
                        variant={order.status === 'refunded' ? 'destructive' : 'secondary'}
                      >
                        {order.status === 'refunded' ? 'Fully Refunded' : 'Partially Refunded'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at || ""), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      Original Total: ${Number(order.total).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refund Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              {selectedOrder && (
                <>Refund for Order #{selectedOrder.substring(0, 8)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty for full refund. Maximum: $
                {selectedOrder && orders?.find(o => o.id === selectedOrder)?.total
                  ? Number(orders.find(o => o.id === selectedOrder)!.total).toFixed(2)
                  : "0.00"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason (Optional)</Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedOrder(null);
                  setRefundAmount("");
                  setRefundReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={submitRefund}
                disabled={refundMutation.isPending}
              >
                {refundMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Issue Refund
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

