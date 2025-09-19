import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { requireOwnerAuth } from "@/lib/auth-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OwnerOnboardingSuccessPage() {
  await requireOwnerAuth();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4">
      <Card>
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl">You&apos;re all set!</CardTitle>
          <CardDescription>
            Your basic salon profile is ready. Here&apos;s what to do next so clients can start booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 text-left">
            <p className="text-sm font-medium uppercase text-muted-foreground">What&apos;s next</p>
            <ul className="space-y-2 text-base">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                <span>
                  <strong>Add categories & services</strong> – build out what clients can book. Each service needs a price and duration.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                <span>
                  <strong>Invite your team</strong> – add staff so you can assign them to appointments.
                </span>
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/catalog">
                Go to Catalog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/staffs">
                Add Staff members
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard">
                Open Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
