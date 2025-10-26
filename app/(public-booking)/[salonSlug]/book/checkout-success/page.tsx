import { redirect } from "next/navigation";
import Link from "next/link";

import { finalizeBookingCheckoutSession } from "@/app/actions/stripe-checkout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type PageProps = {
  params: Promise<{ salonSlug: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ params, searchParams }: PageProps) {
  const { salonSlug } = await params;
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect(`/${salonSlug}/book?checkout=missing`);
  }

  const result = await finalizeBookingCheckoutSession(sessionId, salonSlug);
  console.log("🚀 ~ CheckoutSuccessPage ~ result:", result)
  
  if (!result.success || !result.appointmentId || !result.clientName || !result.date || !result.time) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {result.recoverable ? "Payment is still pending" : "We&apos;re reviewing your booking"}
            </CardTitle>
            <CardDescription>
              {result.recoverable
                ? "Stripe is finalising the payment. This usually takes just a few seconds."
                : "Something went wrong while confirming the payment. Don&apos;t worry—we&apos;re on it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Payment status unclear</AlertTitle>
              <AlertDescription>
                {result.error ?? "We couldn’t link your payment to an appointment automatically."}
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground">
              {result.recoverable
                ? "Your card has been authorised but Stripe is still finalising the charge. Try refreshing this page in a moment, or contact the salon if the payment does not appear soon."
                : "Your card may have been charged. Please reach out to the salon so they can confirm and finish your booking."}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant={result.recoverable ? "default" : "outline"}>
                <Link href={`/${salonSlug}/book/checkout-success?session_id=${encodeURIComponent(sessionId)}`}>
                  Refresh status
                </Link>
              </Button>
              <Button asChild variant={result.recoverable ? "outline" : "default"}>
                <Link href={`/${salonSlug}/book`}>Back to booking</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${salonSlug}`}>Contact the salon</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const paramsForConfirmation = new URLSearchParams({
    appointmentId: result.appointmentId,
    clientName: result.clientName,
    date: result.date,
    time: result.time,
    services: encodeURIComponent((result.services ?? []).join(", ")),
    duration: String(result.durationMinutes ?? 0),
    total: String(result.totalPrice ?? 0),
  });

  redirect(`/${salonSlug}/book/confirmation?${paramsForConfirmation.toString()}`);
}
