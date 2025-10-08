import Link from "next/link";

import { listConnectedProducts } from "@/app/actions/stripe-connect-demo";
import { AccountTools } from "@/components/connect-demo/account-tools";
import { assertConnectedAccountId, getStripeServerClient } from "@/lib/stripe";
import { AccountSummary, ProductSummary, toAccountSummary } from "@/lib/stripe-connect";

interface ConnectDemoPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

/**
 * Platform dashboard that orchestrates connected account onboarding and catalog management.
 * All data reads happen directly against Stripe (no platform database) to keep the demo transparent and stateless.
 */
async function fetchAccountSummary(accountId: string): Promise<{ summary: AccountSummary | null; error?: string }> {
  try {
    const verifiedAccountId = assertConnectedAccountId(accountId);
    const stripe = getStripeServerClient();
    const account = await stripe.accounts.retrieve(verifiedAccountId);
    return { summary: toAccountSummary(account) };
  } catch (error) {
    console.error("Unable to fetch connected account summary", error);
    return {
      summary: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to fetch account summary from Stripe. Confirm the Stripe secret key and account id are correct.",
    };
  }
}

async function fetchProductsForAccount(accountId: string): Promise<{ products: ProductSummary[]; error?: string }> {
  try {
    const products = await listConnectedProducts(accountId);
    return { products };
  } catch (error) {
    console.error("Unable to fetch products for connected account", error);
    return {
      products: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load products from Stripe. Check the server logs for more detail.",
    };
  }
}

export default async function ConnectDemoPage({ searchParams }: ConnectDemoPageProps) {
  const accountIdParam = typeof searchParams?.accountId === "string" ? searchParams?.accountId : undefined;
  const accountResult = accountIdParam ? await fetchAccountSummary(accountIdParam) : { summary: null };
  const productResult = accountIdParam ? await fetchProductsForAccount(accountIdParam) : { products: [] };
  const { summary: accountSummary, error: accountError } = accountResult;
  const { products, error: productError } = productResult;
  const onboarded = searchParams?.onboarded === "true";

  return (
    <div className="space-y-12">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold">Platform admin tools</h2>
          <p className="text-sm text-slate-600">
            Use this dashboard to walk through account creation, onboarding, and product setup. Each server action includes
            detailed comments so you can replicate the flow in your own codebase.
          </p>
        </header>

        {onboarded ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            The connected account returned from onboarding. Refresh its status below to confirm what Stripe still requires.
          </p>
        ) : null}

        {accountError ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {accountError}
          </p>
        ) : null}

        <AccountTools initialAccountId={accountIdParam} initialAccountSummary={accountSummary} />
      </section>

      {accountIdParam ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold">Products on {accountIdParam}</h2>
            <p className="text-sm text-slate-600">
              Products load live from Stripe using the <code>Stripe-Account</code> header. Share the storefront link below with the
              connected business so their clients can make purchases.
            </p>
          </header>

          <div className="rounded border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700">
            <p className="font-medium">Shareable storefront link</p>
            <p>
              <code className="break-all">
                {`/connect-demo/${accountIdParam}`} {/* In production you should expose a human-friendly slug instead of the raw acct_ id. */}
              </code>
            </p>
          </div>

          {productError ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{productError}</p>
          ) : null}

          {products.length ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left uppercase tracking-wide text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Price ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {products.map((product) => (
                    <tr key={product.productId}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{product.name}</div>
                        {product.description ? (
                          <p className="text-xs text-slate-600">{product.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {new Intl.NumberFormat("en-AU", {
                          style: "currency",
                          currency: product.currency.toUpperCase(),
                        }).format(product.unitAmount / 100)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{product.defaultPriceId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No products yet. Use the form above to create one.</p>
          )}

          <div className="text-sm text-slate-600">
            <p>
              Buyers can test the storefront via the hosted checkout page. Stripe&apos;s test card numbers work as expected.
              Review the code in <code>components/connect-demo/storefront.tsx</code> for a public-facing example.
            </p>
            <p>
              Ready to try it? Visit the storefront page below.
            </p>
            <Link href={`/connect-demo/${accountIdParam}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Open storefront
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-4 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          <p>
            Create or paste a connected account id to see its products. The forms above always fetch live data directly from Stripe,
            so you can reload the page to confirm changes.
          </p>
          <p>
            Once you have an account id, append <code>?accountId=acct_123</code> to this page or use the onboarding form to populate it automatically.
          </p>
        </section>
      )}
    </div>
  );
}
