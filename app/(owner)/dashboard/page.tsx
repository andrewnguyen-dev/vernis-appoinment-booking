import prisma from "@/db";
import SignOut from "@/components/auth/sign-out";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getOwnerSalonOrThrow } from "@/lib/user-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, subDays } from "date-fns";
import { PaymentStatus } from "@prisma/client";
import {
  Calendar,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  Wallet,
  RefreshCw,
} from "lucide-react";

const statusStyles: Record<
  PaymentStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  [PaymentStatus.PAID]: { label: "Paid", variant: "default" },
  [PaymentStatus.PENDING]: { label: "Pending", variant: "secondary" },
  [PaymentStatus.AUTHORIZED]: { label: "Authorised", variant: "secondary" },
  [PaymentStatus.REFUNDED]: {
    label: "Refunded",
    variant: "outline",
    className: "border-amber-400 text-amber-700",
  },
  [PaymentStatus.FAILED]: { label: "Failed", variant: "destructive" },
};

function formatCurrency(amountCents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function toClientName(
  client?: { firstName: string; lastName: string | null } | null
): string {
  if (!client) {
    return "Walk-in";
  }

  const parts = [client.firstName, client.lastName ?? ""].filter(Boolean);
  return parts.length ? parts.join(" ") : "Walk-in";
}

export default async function DashboardPage() {
  const session = await requireOwnerAuth();
  const salon = await getOwnerSalonOrThrow(session.user.id);

  const startOfToday = startOfDay(new Date());
  const startOfWeek = subDays(startOfToday, 6);

  const [
    todayRevenueAgg,
    weekRevenueAgg,
    pendingPayoutAgg,
    refundedAgg,
    pendingPaymentsCount,
    totalPaymentsCount,
    payments,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: {
        appointment: { salonId: salon.id },
        status: PaymentStatus.PAID,
        createdAt: { gte: startOfToday },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: {
        appointment: { salonId: salon.id },
        status: PaymentStatus.PAID,
        createdAt: { gte: startOfWeek },
      },
    }),
    prisma.payment.aggregate({
      _sum: { netAmount: true },
      where: {
        appointment: { salonId: salon.id },
        status: PaymentStatus.PAID,
        netAmount: { not: null },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: {
        appointment: { salonId: salon.id },
        status: PaymentStatus.REFUNDED,
        refundedAt: { gte: startOfWeek },
      },
    }),
    prisma.payment.count({
      where: {
        appointment: { salonId: salon.id },
        status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
      },
    }),
    prisma.payment.count({
      where: {
        appointment: { salonId: salon.id },
      },
    }),
    prisma.payment.findMany({
      where: { appointment: { salonId: salon.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        appointment: {
          select: {
            startsAt: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const currency =
    payments.find((payment) => payment.currency)?.currency ?? "AUD";

  const todaysRevenueValue = formatCurrency(
    todayRevenueAgg._sum.amountCents ?? 0,
    currency
  );
  const weekRevenueValue = formatCurrency(
    weekRevenueAgg._sum.amountCents ?? 0,
    currency
  );
  const pendingPayoutValue = formatCurrency(
    pendingPayoutAgg._sum.netAmount ?? 0,
    currency
  );
  const refundedValue = formatCurrency(
    refundedAgg._sum.amountCents ?? 0,
    currency
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name}! Here&apos;s your business overview.
          </p>
        </div>
        <SignOut />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <p className="text-muted-foreground italic text-sm">This feature is in development. The numbers below are placeholders.</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Today&apos;s Appointments
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">+0 from yesterday</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Revenue (Today)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0,000</div>
                <p className="text-xs text-muted-foreground">+15% from yesterday</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">000</div>
                <p className="text-xs text-muted-foreground">+0 new this week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg. Service Time
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">00m</div>
                <p className="text-xs text-muted-foreground">-0m from last week</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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
                      <p className="text-sm text-muted-foreground">Haircut &amp; Style</p>
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
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total payments</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPaymentsCount}</div>
                <p className="text-xs text-muted-foreground">Across all providers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue (Today)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todaysRevenueValue}</div>
                <p className="text-xs text-muted-foreground">Paid bookings only</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue (7 days)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{weekRevenueValue}</div>
                <p className="text-xs text-muted-foreground">Rolling window</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending payouts</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingPayoutValue}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingPaymentsCount} payment{pendingPaymentsCount === 1 ? "" : "s"} awaiting capture
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Refunds &amp; adjustments</CardTitle>
                <CardDescription>Last 7 days across all providers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Refunded</p>
                    <p className="text-2xl font-semibold">{refundedValue}</p>
                  </div>
                  <RefreshCw className="h-10 w-10 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>
                Latest activity across Stripe and manual providers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No payments recorded yet. Complete a booking to see it show up here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Provider</TableHead>
                        <TableHead className="hidden lg:table-cell">Captured</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => {
                        const statusStyle = statusStyles[payment.status];
                        const amount = formatCurrency(payment.amountCents, payment.currency ?? currency);
                        const capturedAt = payment.capturedAt ?? payment.createdAt;

                        return (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="font-medium">{amount}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(payment.createdAt, "dd MMM yyyy HH:mm")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {toClientName(payment.appointment?.client)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {payment.appointment?.client?.email ?? "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={statusStyle.variant}
                                className={statusStyle.className}
                              >
                                {statusStyle.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {payment.provider}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-right">
                              {format(capturedAt, "dd MMM yyyy HH:mm")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
