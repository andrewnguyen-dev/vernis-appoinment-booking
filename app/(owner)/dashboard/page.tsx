import SignOut from "@/components/auth/sign-out";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getOwnerSalonOrThrow } from "@/lib/user-utils";
import { PaymentStatusWidget } from "@/components/dashboard/payment-status-widget";
import { PaymentMetricsWidget } from "@/components/dashboard/payment-metrics-widget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, Users, Clock } from "lucide-react";

export default async function DashboardPage() {
  // This will redirect to /owner-sign-in if not authenticated or not an owner
  const session = await requireOwnerAuth();
  const salon = await getOwnerSalonOrThrow(session.user.id);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name}! Here&apos;s your business overview.
          </p>
        </div>
        <SignOut />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">+2 from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (Today)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,420</div>
            <p className="text-xs text-muted-foreground">+15% from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">+3 new this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Service Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45m</div>
            <p className="text-xs text-muted-foreground">-2m from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Your next appointments for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Sarah Johnson</p>
                  <p className="text-sm text-muted-foreground">Haircut & Style</p>
                </div>
                <div className="text-sm text-muted-foreground">10:00 AM</div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Mike Chen</p>
                  <p className="text-sm text-muted-foreground">Color Treatment</p>
                </div>
                <div className="text-sm text-muted-foreground">11:30 AM</div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Emily Davis</p>
                  <p className="text-sm text-muted-foreground">Highlights</p>
                </div>
                <div className="text-sm text-muted-foreground">2:00 PM</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Payment Status Widget */}
          <PaymentStatusWidget stripeAccountId={salon.stripeAccountId} />
          
          {/* Payment Metrics Widget */}
          <PaymentMetricsWidget />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Summary</CardTitle>
            <CardDescription>Your earnings breakdown for this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Haircuts</span>
                <span className="text-sm text-muted-foreground">$2,840</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Color Services</span>
                <span className="text-sm text-muted-foreground">$1,920</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Styling</span>
                <span className="text-sm text-muted-foreground">$780</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Products</span>
                <span className="text-sm text-muted-foreground">$340</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span>$5,880</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
