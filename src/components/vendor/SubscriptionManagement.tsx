'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CreditCard, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import {
  getVendorSubscription,
  createVendorSubscription,
  updateVendorSubscription,
  cancelVendorSubscription,
  createSubscriptionCheckout,
  createCustomerPortalSession,
  type VendorSubscription,
} from "@/lib/api"
import { SUBSCRIPTION_TIERS, SubscriptionTier } from "@/lib/subscription-tiers"
import { SubscriptionTierCard } from "./SubscriptionTierCard"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function SubscriptionManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null)
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false)

  // Fetch current subscription
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["vendorSubscription"],
    queryFn: getVendorSubscription,
  })

  // Create/update subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: (tier: SubscriptionTier) => createVendorSubscription(tier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] })
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] })
      toast({
        title: "Subscription updated",
        description: "Your subscription has been updated successfully.",
      })
      setIsUpgradeDialogOpen(false)
      setSelectedTier(null)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      })
    },
  })

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: cancelVendorSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] })
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] })
      toast({
        title: "Subscription canceled",
        description: "Your subscription has been canceled.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      })
    },
  })

  // Create checkout session mutation
  const checkoutMutation = useMutation({
    mutationFn: (tier: SubscriptionTier) => createSubscriptionCheckout(tier),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      })
    },
  })

  // Create customer portal session mutation
  const portalMutation = useMutation({
    mutationFn: createCustomerPortalSession,
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      })
    },
  })

  const currentTier = (subscription?.tier || "free") as SubscriptionTier
  const tierConfig = SUBSCRIPTION_TIERS[currentTier]
  const isActive = subscription?.status === "active"
  const isCanceled = subscription?.status === "canceled"
  const isPastDue = subscription?.status === "past_due"

  const handleUpgrade = () => {
    if (!selectedTier) return

    if (selectedTier === "free") {
      createSubscriptionMutation.mutate("free")
    } else {
      // For paid tiers, use Stripe Checkout
      checkoutMutation.mutate(selectedTier)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>Manage your subscription plan</CardDescription>
            </div>
            <Badge variant={isActive ? "default" : isPastDue ? "destructive" : "secondary"}>
              {subscription?.status || "inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Plan</span>
                <span className="text-sm">{tierConfig.name}</span>
              </div>
              {subscription.current_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {subscription.cancel_at_period_end ? "Cancels on" : "Renews on"}
                  </span>
                  <span className="text-sm">
                    {format(new Date(subscription.current_period_end), "MMM dd, yyyy")}
                  </span>
                </div>
              )}
              {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trial ends</span>
                  <span className="text-sm">
                    {format(new Date(subscription.trial_end), "MMM dd, yyyy")}
                  </span>
                </div>
              )}
            </div>
          )}

          {isPastDue && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your subscription payment failed. Please update your payment method.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {subscription?.stripe_subscription_id && (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Manage Subscription
              </Button>
            )}
            {!isCanceled && subscription && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm("Are you sure you want to cancel your subscription?")) {
                    cancelSubscriptionMutation.mutate()
                  }
                }}
                disabled={cancelSubscriptionMutation.isPending}
              >
                {cancelSubscriptionMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Cancel Subscription"
                )}
              </Button>
            )}
            <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {subscription ? "Change Plan" : "Select Plan"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Choose Your Subscription Plan</DialogTitle>
                  <DialogDescription>
                    Select a plan that fits your business needs
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  {(["free", "basic", "pro", "premium"] as SubscriptionTier[]).map((tier) => (
                    <SubscriptionTierCard
                      key={tier}
                      tier={tier}
                      isSelected={selectedTier === tier}
                      isCurrent={currentTier === tier}
                      onSelect={setSelectedTier}
                    />
                  ))}
                </div>
                {selectedTier && selectedTier !== currentTier && (
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsUpgradeDialogOpen(false)
                        setSelectedTier(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpgrade}
                      disabled={createSubscriptionMutation.isPending || checkoutMutation.isPending}
                    >
                      {createSubscriptionMutation.isPending || checkoutMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : selectedTier === "free" ? (
                        "Switch to Free"
                      ) : (
                        "Continue to Checkout"
                      )}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Features */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan Features</CardTitle>
          <CardDescription>What's included in your {tierConfig.name} plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tierConfig.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm capitalize">{feature.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

