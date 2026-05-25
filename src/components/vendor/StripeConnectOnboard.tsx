'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CreditCard, ExternalLink, CheckCircle2, AlertCircle, XCircle } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import {
  startConnectOnboarding,
  getConnectStatus,
  type ConnectStatus,
} from "@/lib/api"

export function StripeConnectOnboard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch Connect status
  const { data: connectStatus, isLoading } = useQuery({
    queryKey: ["connectStatus"],
    queryFn: getConnectStatus,
  })

  // Start onboarding mutation
  const onboardMutation = useMutation({
    mutationFn: startConnectOnboarding,
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url
      }
      queryClient.invalidateQueries({ queryKey: ["connectStatus"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start Connect onboarding",
        variant: "destructive",
      })
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const status = connectStatus?.status || "not_started"
  const isActive = status === "active" && connectStatus?.charges_enabled && connectStatus?.payouts_enabled
  const isPending = status === "pending"
  const needsOnboarding = status === "not_started"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Stripe Connect Account</CardTitle>
            <CardDescription>Set up payments to receive payouts from sales</CardDescription>
          </div>
          <Badge
            variant={
              isActive
                ? "default"
                : isPending
                ? "secondary"
                : "destructive"
            }
          >
            {isActive ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Active
              </>
            ) : isPending ? (
              <>
                <AlertCircle className="mr-1 h-3 w-3" />
                Pending
              </>
            ) : (
              <>
                <XCircle className="mr-1 h-3 w-3" />
                Not Set Up
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isActive ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Your Stripe Connect account is active and ready to receive payments.
              {connectStatus?.charges_enabled && " Charges are enabled."}
              {connectStatus?.payouts_enabled && " Payouts are enabled."}
            </AlertDescription>
          </Alert>
        ) : isPending ? (
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {connectStatus?.details || "Your Stripe Connect account is being set up. Please complete the onboarding process."}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to set up your Stripe Connect account to receive payouts from sales.
            </AlertDescription>
          </Alert>
        )}

        {connectStatus && (
          <div className="space-y-2 text-sm">
            {connectStatus.account_id && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Account ID</span>
                <span className="font-mono text-xs">{connectStatus.account_id}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium">Charges Enabled</span>
              <Badge variant={connectStatus.charges_enabled ? "default" : "secondary"}>
                {connectStatus.charges_enabled ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Payouts Enabled</span>
              <Badge variant={connectStatus.payouts_enabled ? "default" : "secondary"}>
                {connectStatus.payouts_enabled ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        )}

        {needsOnboarding && (
          <Button
            className="w-full"
            onClick={() => onboardMutation.mutate()}
            disabled={onboardMutation.isPending}
          >
            {onboardMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Set Up Stripe Connect
              </>
            )}
          </Button>
        )}

        {isPending && (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => onboardMutation.mutate()}
            disabled={onboardMutation.isPending}
          >
            {onboardMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Complete Onboarding
              </>
            )}
          </Button>
        )}

        {isActive && (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              // Open Stripe Dashboard for the connected account
              if (connectStatus?.account_id) {
                window.open(
                  `https://dashboard.stripe.com/connect/accounts/${connectStatus.account_id}`,
                  "_blank"
                )
              }
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Stripe Dashboard
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

