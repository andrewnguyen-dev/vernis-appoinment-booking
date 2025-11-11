import { redirect } from "next/navigation";
import Link from "next/link";

import { finalizeBookingCheckoutSession } from "@/app/actions/stripe-checkout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{ salonSlug: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function BalancePaymentSuccessPage({ params, searchParams }: PageProps) {
  const { salonSlug } = await params;
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect(`/${salonSlug}/book?balance=missing`);
  }

  const result = await finalizeBookingCheckoutSession(sessionId, salonSlug);

  if (!result.success || !result.appointmentId) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">We couldn&apos;t confirm that payment</CardTitle>
            <CardDescription>Please try refreshing this page or contact the salon directly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Payment status unknown</AlertTitle>
              <AlertDescription>{result.error ?? "Stripe didn’t confirm this payment yet."}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/${salonSlug}/pay/balance/success?session_id=${encodeURIComponent(sessionId)}`}>
                  Refresh status
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${salonSlug}`}>Contact the salon</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Balance payment received</CardTitle>
          <CardDescription>Thanks! The salon has been notified of your payment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Appointment</p>
            <p className="font-medium">
              {result.date} at {result.time}
            </p>
          </div>
          {result.services && result.services.length ? (
            <div>
              <p className="text-muted-foreground">Services</p>
              <p className="font-medium">{result.services.join(", ")}</p>
            </div>
          ) : null}
          <div className="pt-4">
            <Button asChild className="w-full">
              <Link href={`/${salonSlug}`}>Back to salon page</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
