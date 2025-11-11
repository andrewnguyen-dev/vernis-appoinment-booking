import Link from "next/link";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{ salonSlug: string }>;
};

export default async function BalancePaymentCancelPage({ params }: PageProps) {
  const { salonSlug } = await params;

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Payment cancelled</CardTitle>
          <CardDescription>No charges were made. You can try again or pay in person at the salon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Button asChild className="w-full">
            <Link href={`/${salonSlug}`}>Back to salon</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
