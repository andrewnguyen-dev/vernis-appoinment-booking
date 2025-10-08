import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stripe Connect Demo | Vernis",
  description:
    "Sample Stripe Connect integration that creates accounts, products, and a storefront for connected salons.",
};

interface ConnectDemoLayoutProps {
  children: React.ReactNode;
}

/**
 * Minimal layout wrapper for the Stripe Connect demo flow.
 * We keep the styling intentionally plain so developers can port snippets into their own stack easily.
 */
export default function ConnectDemoLayout({ children }: ConnectDemoLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Stripe Connect sample</h1>
            <p className="text-sm text-slate-600">
              This walkthrough lives entirely client-side for demo purposes. Replace it with production-ready flows before going live.
            </p>
          </div>
          <nav className="text-sm">
            <Link href="/connect-demo" className="font-medium text-primary hover:underline">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="space-y-10">{children}</div>
      </div>
    </main>
  );
}
