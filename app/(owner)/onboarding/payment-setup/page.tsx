import prisma from "@/db";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { generateOnboardingLink, syncAccountStatus } from "@/lib/services/stripe-connect-service";
import { getOwnerSalonOrThrow } from "@/lib/user-utils";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowUpRight, CheckCircle2, RefreshCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface PaymentSetupPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Payments ready";
    case "restricted":
      return "Action required";
    default:
      return "Pending setup";
  }
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "restricted":
      return "destructive";
    default:
      return "secondary";
  }
}

function RequirementList({
  title,
  items,
  description,
}: {
  title: string;
  items: string[];
  description?: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-foreground">{title}</p>
        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
          {items.length} item{items.length > 1 ? "s" : ""}
        </Badge>
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item} className="break-all">
            {item.replace(/\./g, " › ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function PaymentSetupPage({ searchParams }: PaymentSetupPageProps) {
  const session = await requireOwnerAuth({ allowIncompleteOnboarding: true });
  const salon = await getOwnerSalonOrThrow(session.user.id);

  if (!salon.stripeAccountId) {
    redirect("/onboarding");
  }

  const snapshot = await syncAccountStatus(salon.id);

  const accountReady =
    snapshot.chargesEnabled &&
    snapshot.payoutsEnabled &&
    snapshot.requirements.currentlyDue.length === 0;

  if (accountReady) {
    if (!salon.hasCompletedOnboarding) {
      await prisma.salon.update({
        where: { id: salon.id },
        data: { hasCompletedOnboarding: true },
      });
    }

    redirect("/onboarding/success");
  }

  if (salon.hasCompletedOnboarding) {
    await prisma.salon.update({
      where: { id: salon.id },
      data: { hasCompletedOnboarding: false },
    });
  }

  const onboardingUrl = await generateOnboardingLink(salon.id);
  const onboardedReturn = searchParams?.onboarded === "1";

  const requirements = snapshot.requirements;
  const hasOpenRequirements =
    requirements.currentlyDue.length > 0 || requirements.pastDue.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Complete payment setup</h1>
        <p className="text-muted-foreground">
          Stripe Connect powers payouts for Vernis salons. Finish onboarding below so clients can pay online.
        </p>
      </div>

      {onboardedReturn ? (
        <Alert className="bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="text-emerald-600" />
          <AlertTitle>Welcome back from Stripe</AlertTitle>
          <AlertDescription>
            Stripe received your information. Give it a moment while we confirm the remaining requirements.
          </AlertDescription>
        </Alert>
      ) : null}

      {requirements.disabledReason ? (
        <Alert variant="destructive" className="border-destructive bg-destructive/5">
          <ShieldAlert />
          <AlertTitle>Account temporarily restricted</AlertTitle>
          <AlertDescription>
            {requirements.disabledReason.replace(/_/g, " ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            Account status
            <Badge variant={statusBadgeVariant(snapshot.status)}>
              {formatStatusLabel(snapshot.status)}
            </Badge>
          </CardTitle>
          <CardDescription>
            Stripe reviews the details you provide and unlocks charges & payouts when everything checks out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-sm">
            <p className="text-muted-foreground">Connected account ID</p>
            <p className="font-mono text-sm text-foreground">{snapshot.accountId}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={cn("rounded-lg border p-4", snapshot.chargesEnabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {snapshot.chargesEnabled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                Charges
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshot.chargesEnabled
                  ? "Stripe can process bookings for this salon."
                  : "Finish onboarding steps so Stripe can process card payments."}
              </p>
            </div>

            <div className={cn("rounded-lg border p-4", snapshot.payoutsEnabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {snapshot.payoutsEnabled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                Payouts
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshot.payoutsEnabled
                  ? "Stripe can deposit earnings into the connected bank account."
                  : "Provide banking details so Stripe knows where to send payouts."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Outstanding requirements
            {!hasOpenRequirements ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                Submitted
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Stripe lists required documents and verifications. Complete each item to activate payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasOpenRequirements ? (
            <>
              <RequirementList
                title="Provide these items"
                description="Stripe needs this information before clients can be charged."
                items={[...requirements.currentlyDue, ...requirements.pastDue]}
              />
              <RequirementList
                title="Stripe is reviewing"
                description="These submissions are pending Stripe's review. No action required unless Stripe emails you."
                items={requirements.pendingVerification}
              />
              <RequirementList
                title="Coming up later"
                description="Keep an eye on these requirements—Stripe may ask for them in the future."
                items={requirements.eventuallyDue}
              />
            </>
          ) : (
            <Alert className="border border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="text-emerald-600" />
              <AlertTitle>No outstanding tasks</AlertTitle>
              <AlertDescription>
                Stripe is reviewing your submissions. We&apos;ll email you if anything else is required.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Finish in Stripe</CardTitle>
          <CardDescription>
            Stay in Stripe until you see confirmation. Refresh this page afterwards to pull the latest status.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={onboardingUrl} target="_blank" rel="noreferrer">
              Continue in Stripe
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </a>
          </Button>

          <Button variant="outline" asChild>
            <Link href="/onboarding/payment-setup">
              Refresh status
              <RefreshCcw className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button variant="ghost" asChild>
            <a
              href={`https://dashboard.stripe.com/connect/accounts/${snapshot.accountId}`}
              target="_blank"
              rel="noreferrer"
            >
              Open Stripe Express
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
