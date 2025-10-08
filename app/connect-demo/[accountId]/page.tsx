import Link from "next/link";

import { listConnectedProducts, retrieveCheckoutSession } from "@/app/actions/stripe-connect-demo";
import { Storefront } from "@/components/connect-demo/storefront";
import { assertConnectedAccountId } from "@/lib/stripe";
import { CheckoutSessionSummary, ProductSummary } from "@/lib/stripe-connect";

interface StorefrontPageProps {
  params: { accountId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

/**
 * Public storefront that renders products for a single connected account.
 * The page intentionally accepts the raw Stripe account id for clarity, but production apps should resolve it from a slug.
 */
async function fetchProducts(accountId: string): Promise<{ products: ProductSummary[]; error?: string }> {
  try {
    const products = await listConnectedProducts(accountId);
    return { products };
  } catch (error) {
    console.error("Failed to load products for storefront", error);
    return {
      products: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load products from Stripe. Confirm the account id and API key are valid.",
    };
  }
}

async function fetchSessionSummary(accountId: string, sessionId: string): Promise<{ summary: CheckoutSessionSummary | null; error?: string }> {
  try {
    const summary = await retrieveCheckoutSession(accountId, sessionId);
    return { summary };
  } catch (error) {
    console.error("Failed to load checkout session", error);
    return {
      summary: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load the checkout session. Check the event logs in Stripe for details.",
    };
  }
}

export default async function StorefrontPage({ params, searchParams }: StorefrontPageProps) {
  const accountId = decodeURIComponent(params.accountId);

  try {
    assertConnectedAccountId(accountId);
  } catch (error) {
    return (
      <div className="space-y-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold">Invalid account id</p>
        <p>
          {error instanceof Error
            ? error.message
            : "The provided account identifier is not valid. Double-check the acct_ value and try again."}
        </p>
        <Link href="/connect-demo" className="font-medium underline">
          Go back to the Connect demo
        </Link>
      </div>
    );
  }

  const { products, error: productError } = await fetchProducts(accountId);
  const sessionId = typeof searchParams?.session_id === "string" ? searchParams?.session_id : undefined;
  const sessionResult = sessionId ? await fetchSessionSummary(accountId, sessionId) : { summary: null };
  const { summary: session, error: sessionError } = sessionResult;

  return (
    <div className="space-y-10">
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Salon storefront</h1>
            <p className="text-sm text-slate-600">
              Products and checkout sessions execute using connected account <code>{accountId}</code>.
            </p>
          </div>
          <Link href="/connect-demo" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Back to platform view
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {productError ? (
          <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{productError}</p>
        ) : null}
        {sessionError ? (
          <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{sessionError}</p>
        ) : null}
        <Storefront accountId={accountId} products={products} successSession={session} />
      </section>
    </div>
  );
}
