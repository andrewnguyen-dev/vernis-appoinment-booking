"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, CreditCard, Users } from "lucide-react";

interface PaymentMetricsProps {
  className?: string;
}

interface PaymentMetrics {
  todayRevenue: number;
  weeklyRevenue: number;
  totalPayments: number;
  successRate: number;
  averageTransaction: number;
  isLoading: boolean;
}

export function PaymentMetricsWidget({ className }: PaymentMetricsProps) {
  const [metrics, setMetrics] = useState<PaymentMetrics>({
    todayRevenue: 0,
    weeklyRevenue: 0,
    totalPayments: 0,
    successRate: 0,
    averageTransaction: 0,
    isLoading: true,
  });

  useEffect(() => {
    // TODO: Replace with actual API call to fetch payment metrics
    // For now, using mock data
    const loadMetrics = async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMetrics({
        todayRevenue: 42500, // $425.00 in cents
        weeklyRevenue: 180000, // $1,800.00 in cents
        totalPayments: 47,
        successRate: 96.8,
        averageTransaction: 8500, // $85.00 in cents
        isLoading: false,
      });
    };

    loadMetrics();
  }, []);

  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(cents / 100);
  }

  if (metrics.isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Payment Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Payment Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              Today&apos;s Revenue
            </div>
            <span className="text-sm font-mono">
              {formatCurrency(metrics.todayRevenue)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              This Week
            </div>
            <span className="text-sm font-mono">
              {formatCurrency(metrics.weeklyRevenue)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-3 w-3 text-muted-foreground" />
              Total Payments
            </div>
            <span className="text-sm font-mono">
              {metrics.totalPayments}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-3 w-3 text-muted-foreground" />
              Success Rate
            </div>
            <span className="text-sm font-mono text-green-600">
              {metrics.successRate.toFixed(1)}%
            </span>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Avg. Transaction
              </span>
              <span className="text-sm font-mono font-medium">
                {formatCurrency(metrics.averageTransaction)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}