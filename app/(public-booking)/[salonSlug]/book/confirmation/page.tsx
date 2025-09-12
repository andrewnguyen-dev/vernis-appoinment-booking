import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/tenancy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { formatTimezone } from "@/lib/timezone";

type PageProps = { 
  params: Promise<{ salonSlug: string }>;
  searchParams: Promise<{ 
    appointmentId?: string;
    clientName?: string;
    date?: string;
    time?: string;
    services?: string;
    duration?: string;
    total?: string;
  }>;
};

export default async function ConfirmationPage({ params, searchParams }: PageProps) {
  const { salonSlug } = await params;
  const { 
    appointmentId, 
    clientName, 
    date, 
    time, 
    services, 
    duration, 
    total 
  } = await searchParams;

  const salon = await getSalonBySlug(salonSlug);
  if (!salon) return notFound();

  // If no appointment data is provided, redirect back to booking
  if (!appointmentId || !clientName || !date || !time) {
    return notFound();
  }

  // Parse the date and format it for display
  const appointmentDate = new Date(`${date}T${time}`);
  const formattedDate = formatInTimeZone(appointmentDate, salon.timeZone, "EEEE, MMMM d, yyyy");
  const formattedTime = formatInTimeZone(appointmentDate, salon.timeZone, "h:mm a");

  const formatMoney = (cents: string, currency = "AUD") => {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(parseInt(cents) / 100);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-green-700 mb-2">Booking Confirmed!</h1>
        <p className="text-muted-foreground">Your appointment has been successfully booked</p>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Appointment Details</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <span className="font-medium text-muted-foreground">Salon:</span>
            <span className="font-semibold">{salon.name}</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="font-medium text-muted-foreground">Client:</span>
            <span className="font-semibold">{clientName}</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="font-medium text-muted-foreground">Date:</span>
            <span className="font-semibold">{formattedDate}</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="font-medium text-muted-foreground">Time:</span>
            <span className="font-semibold">{formattedTime} ({formatTimezone(salon.timeZone)})</span>
          </div>

          {services && (
            <div className="flex justify-between items-start">
              <span className="font-medium text-muted-foreground">Services:</span>
              <span className="font-semibold text-right">{decodeURIComponent(services)}</span>
            </div>
          )}

          {duration && (
            <div className="flex justify-between items-start">
              <span className="font-medium text-muted-foreground">Duration:</span>
              <span className="font-semibold">{duration} minutes</span>
            </div>
          )}

          {total && (
            <div className="flex justify-between items-start border-t pt-4">
              <span className="font-medium text-muted-foreground">Total:</span>
              <span className="font-bold text-lg">{formatMoney(total)}</span>
            </div>
          )}

          <div className="flex justify-between items-start">
            <span className="font-medium text-muted-foreground">Appointment ID:</span>
            <span className="font-mono text-sm">{appointmentId}</span>
          </div>
        </div>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">What&apos;s Next?</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          {/* <li>• You should receive a confirmation email shortly</li> */}
          <li>• Please arrive 5-10 minutes before your appointment time</li>
          <li>• If you need to reschedule or cancel, please contact the salon directly</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button asChild variant="outline">
          <Link href={`/${salonSlug}/book`}>
            Book Another Appointment
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/${salonSlug}`}>
            Back to {salon.name}
          </Link>
        </Button>
      </div>
    </main>
  );
}
