import { format } from "date-fns";

import prisma from "@/db";
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
import { PaymentStatus } from "@prisma/client";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  RefreshCw,
} from "lucide-react";

const statusStyles: Record<
  PaymentStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
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

function getClientName(
  client?: { firstName: string; lastName: string | null } | null
): string {
  if (!client) {
    return "Walk-in";
  }

  const parts = [client.firstName, client.lastName ?? ""].filter(Boolean);
  return parts.length ? parts.join(" ") : "Walk-in";
}

export default async function PaymentsPage() {
  const session = await requireOwnerAuth();
  const salon = await getOwnerSalonOrThrow(session.user.id);

  const [todayAgg, weekAgg, pendingAgg, refundedAgg, pendingCount, payments] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: {
          appointment: { salonId: salon.id },
          status: PaymentStatus.PAID,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: {
          appointment: { salonId: salon.id },
          status: PaymentStatus.PAID,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
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
          refundedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.payment.count({
        where: {
          appointment: { salonId: salon.id },
          status: {
            in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED],
          },
        },
      }),
      prisma.payment.findMany({
        where: { appointment: { salonId: salon.id } },
        orderBy: { createdAt: "desc" },
        take: 20,
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
    payments.find((payment) => Boolean(payment.currency))?.currency ?? "AUD";

  const todayValue = formatCurrency(todayAgg._sum.amountCents ?? 0, currency);
  const weekValue = formatCurrency(weekAgg._sum.amountCents ?? 0, currency);
  const pendingPayouts = formatCurrency(
    pendingAgg._sum.netAmount ?? 0,
    currency
  );
  const refundedValue = formatCurrency(
    refundedAgg._sum.amountCents ?? 0,
    currency
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          Monitor revenue, payouts, and Stripe activity for {salon.name}.
        </p>
      </div>

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue (Today)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayValue}</div>
                <p className="text-xs text-muted-foreground">
                  Paid bookings confirmed today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue (7 days)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{weekValue}</div>
                <p className="text-xs text-muted-foreground">Rolling window</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending payouts</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingPayouts}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingCount} payment
                  {pendingCount === 1 ? "" : "s"} awaiting capture
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Refunds (7 days)</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{refundedValue}</div>
                <p className="text-xs text-muted-foreground">
                  Issued back to clients this week
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
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
                        <TableHead className="hidden lg:table-cell text-right">
                          Captured
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => {
                        const style = statusStyles[payment.status];
                        const amount = formatCurrency(
                          payment.amountCents,
                          payment.currency ?? currency
                        );
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
                                {getClientName(payment.appointment?.client)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {payment.appointment?.client?.email ?? "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={style.variant}
                                className={style.className}
                              >
                                {style.label}
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
