import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, RefreshCcw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { StripeAccountSnapshot } from "@/lib/services/stripe-connect-service";
import { cn } from "@/lib/utils";

interface StripeSettingsProps {
  salonName: string;
  snapshot: StripeAccountSnapshot | null;
  onboardingUrl?: string | null;
  refreshHref: string;
  dashboardUrl?: string | null;
  accountEmail?: string;
}

interface RequirementListProps {
  title: string;
  items: string[];
  badgeVariant?: "secondary" | "default";
  description?: string;
}

function RequirementList({ title, items, badgeVariant = "secondary", description }: RequirementListProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-foreground">{title}</p>
        <Badge variant={badgeVariant}>
          {items.length} item{items.length > 1 ? "s" : ""}
        </Badge>
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item.replace(/\./g, " › ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusBadgeVariant(status: StripeAccountSnapshot["status"]): "default" | "secondary" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "restricted":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatStatusLabel(status: StripeAccountSnapshot["status"]): string {
  switch (status) {
    case "active":
      return "Payments ready";
    case "restricted":
      return "Action required";
    default:
      return "Pending setup";
  }
}

export function StripeSettings({
  salonName,
  snapshot,
  onboardingUrl,
  refreshHref,
  dashboardUrl,
  accountEmail,
}: StripeSettingsProps) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment &amp; payouts</CardTitle>
          <CardDescription>
            Connect Stripe to start collecting bookings for {salonName}. Finish onboarding from the owner dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="text-amber-500" />
            <AlertTitle>No Stripe account yet</AlertTitle>
            <AlertDescription>
              Complete the onboarding checklist so we can create a Stripe Connect account for this salon.
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link href="/onboarding">
              Resume onboarding
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const expressDashboardUrl =
    dashboardUrl ?? `https://dashboard.stripe.com/connect/accounts/${snapshot.accountId}`;
  const requirements = snapshot.requirements;
  const hasActionRequired =
    requirements.currentlyDue.length > 0 || requirements.pastDue.length > 0 || snapshot.status === "restricted";
  const chargesEnabledCopy = snapshot.chargesEnabled
    ? "Stripe can process card payments for this salon."
    : "Stripe still needs more information before charges can be enabled.";
  const payoutsEnabledCopy = snapshot.payoutsEnabled
    ? "Bank details verified. Payouts will flow to the connected account."
    : "Add or verify bank details so Stripe can transfer earnings.";

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          Payment &amp; payouts
          <Badge variant={statusBadgeVariant(snapshot.status)}>{formatStatusLabel(snapshot.status)}</Badge>
        </CardTitle>
        <CardDescription>
          Stripe Connect manages billing and payouts for {salonName}. Keep these details up to date to avoid payment
          interruptions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-muted-foreground">Connected account</p>
              <p className="font-mono text-sm text-foreground">{snapshot.accountId}</p>
            </div>
            {accountEmail ? (
              <div className="border-l border-border pl-3 text-sm text-muted-foreground">
                Email on file: <span className="text-foreground">{accountEmail}</span>
              </div>
            ) : null}
          </div>
        </div>

        {hasActionRequired ? (
          <Alert variant="destructive" className="border-destructive bg-destructive/5">
            <ShieldAlert />
            <AlertTitle>Stripe needs additional information</AlertTitle>
            <AlertDescription>
              Complete the requirements below. Stripe can pause charges or payouts when details are missing.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div
            className={cn(
              "rounded-lg border p-4 transition-colors",
              snapshot.chargesEnabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {snapshot.chargesEnabled ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              Charges
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{chargesEnabledCopy}</p>
          </div>

          <div
            className={cn(
              "rounded-lg border p-4 transition-colors",
              snapshot.payoutsEnabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {snapshot.payoutsEnabled ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              Payouts
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{payoutsEnabledCopy}</p>
          </div>
        </div>

        <div className="space-y-4">
          <RequirementList
            title="Provide these items"
            description="Stripe needs these details before payments can run uninterrupted."
            items={[...requirements.currentlyDue, ...requirements.pastDue]}
          />
          <RequirementList
            title="Pending verification"
            badgeVariant="default"
            description="No action needed unless Stripe emails you—these submissions are still being reviewed."
            items={requirements.pendingVerification}
          />
          <RequirementList
            title="Upcoming requirements"
            description="Keep records handy; Stripe may ask for them soon."
            items={requirements.eventuallyDue}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {onboardingUrl ? (
            <Button asChild>
              <a href={onboardingUrl} target="_blank" rel="noreferrer">
                Update payment information
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}

          <Button variant="outline" asChild>
            <Link href={refreshHref}>
              Refresh status
              <RefreshCcw className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button variant="ghost" asChild>
            <a href={expressDashboardUrl} target="_blank" rel="noreferrer">
              Open Stripe dashboard
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
