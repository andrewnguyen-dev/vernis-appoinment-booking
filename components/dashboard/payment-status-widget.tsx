"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  ExternalLink,
  TrendingUp,
  DollarSign,
  Clock
} from "lucide-react";
import { getStripeAccountStatus } from "@/app/actions/stripe-connect";
import { createStripeLoginLink } from "@/app/actions/stripe-connect";
import { toast } from "react-hot-toast";

interface PaymentStatusWidgetProps {
  stripeAccountId?: string | null;
  className?: string;
}

interface StripeAccountStatus {
  connected: boolean;
  status: string | null;
  account?: {
    id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    requirements?: {
      currently_due?: string[] | null;
      eventually_due?: string[] | null;
    };
  };
}

export function PaymentStatusWidget({ stripeAccountId, className }: PaymentStatusWidgetProps) {
  const [accountStatus, setAccountStatus] = useState<StripeAccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      if (!stripeAccountId) {
        setIsLoading(false);
        return;
      }

      try {
        const status = await getStripeAccountStatus();
        setAccountStatus(status);
      } catch (error) {
        console.error("Failed to load Stripe account status:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStatus();
  }, [stripeAccountId]);

  async function handleOpenDashboard() {
    setIsLoadingDashboard(true);
    try {
      await createStripeLoginLink();
    } catch (error) {
      console.error("Failed to open Stripe dashboard:", error);
      toast.error("Failed to open Stripe dashboard. Please try again.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Payment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stripeAccountId || !accountStatus) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Payment Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Connect Stripe to start accepting payments from clients.
            </AlertDescription>
          </Alert>
          <Button size="sm" variant="outline" asChild>
            <a href="/owner/settings#stripe-setup">
              <CreditCard className="mr-2 h-4 w-4" />
              Set Up Payments
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { connected, account } = accountStatus;
  const needsSetup = account?.requirements?.currently_due?.length;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Payment Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Stripe Account:</span>
          {connected ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          ) : needsSetup ? (
            <Badge variant="secondary">
              <AlertCircle className="mr-1 h-3 w-3" />
              Setup Required
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" />
              Not Active
            </Badge>
          )}
        </div>

        {connected && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Charges:</span>
              {account?.charges_enabled ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Payouts:</span>
              {account?.payouts_enabled ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
            </div>
          </div>
        )}

        {needsSetup && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Additional information required to activate payments.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenDashboard}
            disabled={isLoadingDashboard}
            className="flex-1"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {isLoadingDashboard ? "Opening..." : "Dashboard"}
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href="/owner/settings#stripe-setup">Settings</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}