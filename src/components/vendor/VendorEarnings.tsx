'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getVendorBalance, getVendorPayouts } from "@/lib/api";
import { Loader2, DollarSign, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface VendorEarningsProps {
  vendorId: string;
}

export function VendorEarnings({ vendorId }: VendorEarningsProps) {
  // Fetch balance
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["vendorBalance", vendorId],
    queryFn: () => getVendorBalance(vendorId),
    enabled: !!vendorId,
  });

  // Fetch payouts
  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ["vendorPayouts", vendorId],
    queryFn: () => getVendorPayouts(vendorId, 20),
    enabled: !!vendorId,
  });

  if (balanceLoading || payoutsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold">${balance?.available_balance?.toFixed(2) || "0.00"}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready to withdraw</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <p className="text-2xl font-bold">${balance?.pending_balance?.toFixed(2) || "0.00"}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">${balance?.current_balance?.toFixed(2) || "0.00"}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current + Pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lifetime Earnings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <p className="text-2xl font-bold">${balance?.lifetime_earnings?.toFixed(2) || "0.00"}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Recent payouts to your bank account</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts && payouts.length > 0 ? (
            <div className="space-y-4">
              {payouts.map((payout: any) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      payout.status === 'paid' ? 'bg-green-100 dark:bg-green-900' :
                      payout.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900' :
                      'bg-red-100 dark:bg-red-900'
                    }`}>
                      {payout.status === 'paid' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : payout.status === 'pending' ? (
                        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">${payout.amount?.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {payout.arrival_date
                          ? `Arrives ${format(new Date(payout.arrival_date * 1000), 'MMM d, yyyy')}`
                          : payout.created
                          ? format(new Date(payout.created * 1000), 'MMM d, yyyy')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        payout.status === 'paid' ? 'default' :
                        payout.status === 'pending' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {payout.status}
                    </Badge>
                    {payout.method && (
                      <Badge variant="outline">{payout.method}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payouts yet</p>
              <p className="text-sm mt-1">Payouts will appear here once your earnings are transferred</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

