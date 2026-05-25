'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Package, Truck, Download, ExternalLink } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import {
  getShippingRates,
  purchaseShippingLabel,
  getTrackingStatus,
  type ShippingRatesResponse,
  type ShippingLabel,
  type TrackingStatus,
} from "@/lib/api"
import { getUserOrders } from "@/lib/api"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface ShippingLabelManagerProps {
  vendorId?: string
}

export function ShippingLabelManager({ vendorId: vendorIdProp }: ShippingLabelManagerProps) {
  const { toast } = useToast()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isRatesDialogOpen, setIsRatesDialogOpen] = useState(false)
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false)

  const vendorId = vendorIdProp || profile?.id

  // Fetch vendor orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["vendorOrders", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required")
      return getUserOrders(vendorId)
    },
    enabled: !!vendorId,
  })

  // Get orders that need shipping labels (only vendor orders)
  const ordersNeedingShipping = orders?.filter(
    (order) => 
      order.vendor === vendorId && 
      (order.status === "confirmed" || order.status === "paid" || order.status === "pending")
  ) || []

  // Get shipping rates mutation
  const ratesMutation = useMutation({
    mutationFn: getShippingRates,
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get shipping rates",
        variant: "destructive",
      })
    },
  })

  // Purchase label mutation
  const purchaseLabelMutation = useMutation({
    mutationFn: ({ order_id, rate_id }: { order_id: string; rate_id: string }) =>
      purchaseShippingLabel(order_id, rate_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] })
      toast({
        title: "Label purchased",
        description: "Shipping label has been purchased successfully.",
      })
      setIsLabelDialogOpen(false)
      setSelectedOrderId(null)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to purchase shipping label",
        variant: "destructive",
      })
    },
  })

  const handleGetRates = async (orderId: string) => {
    const order = orders?.find((o) => o.id === orderId)
    if (!order) return

    // Extract shipping address from order
    // Check both shipping_address column and metadata.shipping_info
    let shippingInfo: any = null
    if (order.shipping_address && typeof order.shipping_address === 'object') {
      shippingInfo = order.shipping_address
    } else if (order.metadata && typeof order.metadata === 'object') {
      const metadata = order.metadata as any
      shippingInfo = metadata.shipping_info || metadata.shipping_address
    }

    // Get vendor's business address (from vendor profile)
    // For now, use placeholder - in production, get from vendor_profiles
    const fromAddress = {
      name: "Your Business",
      street1: "123 Business St",
      city: "City",
      state: "State",
      zip: "12345",
      country: "US",
    }

    // Use shipping address from order, or show error if missing
    if (!shippingInfo) {
      toast({
        title: "Shipping address missing",
        description: "This order doesn't have a shipping address. Please contact the customer.",
        variant: "destructive",
      })
      return
    }

    try {
      await ratesMutation.mutateAsync({
        order_id: orderId,
        from_address: fromAddress,
        to_address: {
          name: shippingInfo.firstName && shippingInfo.lastName 
            ? `${shippingInfo.firstName} ${shippingInfo.lastName}`
            : shippingInfo.name || "Customer",
          street1: shippingInfo.address || shippingInfo.street1 || shippingInfo.street || "",
          street2: shippingInfo.street2 || "",
          city: shippingInfo.city || "",
          state: shippingInfo.state || "",
          zip: shippingInfo.zipCode || shippingInfo.zip || shippingInfo.postalCode || "",
          country: shippingInfo.country || "US",
          phone: shippingInfo.phone || "",
          email: shippingInfo.email || "",
        },
        parcel: {
          length: "10",
          width: "8",
          height: "4",
          distance_unit: "in",
          weight: "1",
          mass_unit: "lb",
        },
      })
      setSelectedOrderId(orderId)
      setIsRatesDialogOpen(true)
    } catch (error) {
      // Error handled by mutation
    }
  }

  if (ordersLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Shipping Labels</CardTitle>
          <CardDescription>Purchase shipping labels for your orders</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersNeedingShipping.length === 0 ? (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                No orders require shipping labels at this time.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {ordersNeedingShipping.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">Order #{order.id.substring(0, 8)}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), "MMM dd, yyyy")} • ${order.total}
                    </div>
                    {order.tracking_number && (
                      <div className="text-sm mt-1">
                        <Badge variant="outline" className="mr-2">
                          Tracking: {order.tracking_number}
                        </Badge>
                        {order.label_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(order.label_url!, "_blank")}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download Label
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {!order.tracking_number && (
                    <Button
                      variant="outline"
                      onClick={() => handleGetRates(order.id)}
                      disabled={ratesMutation.isPending}
                    >
                      {ratesMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Truck className="mr-2 h-4 w-4" />
                          Get Rates
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Rates Dialog */}
      <Dialog open={isRatesDialogOpen} onOpenChange={setIsRatesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shipping Rates</DialogTitle>
            <DialogDescription>
              Select a shipping rate for your order
            </DialogDescription>
          </DialogHeader>
          {ratesMutation.data && (
            <div className="space-y-4">
              {ratesMutation.data.rates.map((rate) => (
                <Card key={rate.object_id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{rate.provider}</div>
                        <div className="text-sm text-muted-foreground">
                          {rate.servicelevel}
                          {rate.estimated_days && ` • ${rate.estimated_days} days`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${rate.amount}</div>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (selectedOrderId) {
                              purchaseLabelMutation.mutate({
                                order_id: selectedOrderId,
                                rate_id: rate.object_id,
                              })
                              setIsLabelDialogOpen(true)
                            }
                          }}
                          disabled={purchaseLabelMutation.isPending}
                        >
                          {purchaseLabelMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Select"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Label Purchase Success Dialog */}
      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Label Purchased</DialogTitle>
            <DialogDescription>
              Your shipping label has been purchased successfully.
            </DialogDescription>
          </DialogHeader>
          {purchaseLabelMutation.data && (
            <div className="space-y-4">
              <div>
                <Label>Tracking Number</Label>
                <div className="font-mono text-sm">{purchaseLabelMutation.data.tracking_number}</div>
              </div>
              {purchaseLabelMutation.data.label_url && (
                <Button
                  className="w-full"
                  onClick={() => window.open(purchaseLabelMutation.data!.label_url, "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Label
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

