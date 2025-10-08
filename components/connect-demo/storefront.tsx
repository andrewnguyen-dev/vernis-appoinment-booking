"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { ActionResult, createCheckoutSession } from "@/app/actions/stripe-connect-demo";
import { CheckoutSessionSummary, ProductSummary } from "@/lib/stripe-connect";

/**
 * Lightweight public-facing storefront that demonstrates direct charges with a connected account.
 * Each product card posts to a server action that creates a Stripe Checkout session with an application fee.
 */
interface StorefrontProps {
  accountId: string;
  products: ProductSummary[];
  successSession?: CheckoutSessionSummary | null;
}

const emptyCheckoutState: ActionResult<{ session: CheckoutSessionSummary }> = {
  success: false,
  message: "",
};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="w-full rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Redirecting..." : children}
    </button>
  );
}

interface ProductCardProps {
  accountId: string;
  product: ProductSummary;
}

function centsToCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function ProductCheckoutCard({ accountId, product }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [state, formAction] = useActionState(createCheckoutSession, emptyCheckoutState);

  useEffect(() => {
    // Redirect buyers straight to Stripe Checkout once the server action acknowledges success.
    if (state?.success && state.data?.session.url) {
      setIsRedirecting(true);
      window.location.assign(state.data.session.url);
    }
  }, [state]);

  const applicationFeePreview = useMemo(() => {
    // Mirrors the logic from createCheckoutSession so the UI and backend stay aligned on the fee amount.
    const fee = Math.max(50, Math.floor(product.unitAmount * 0.1));
    return centsToCurrency(fee, product.currency);
  }, [product.currency, product.unitAmount]);

  return (
    <article className="flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <header>
          <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
          {product.description ? <p className="text-sm text-slate-600">{product.description}</p> : null}
        </header>

        <div className="text-sm text-slate-700">
          <p className="font-medium">Price</p>
          <p className="font-mono text-base">
            {centsToCurrency(product.unitAmount, product.currency)}
            <span className="ml-2 text-xs text-slate-500">per unit</span>
          </p>
        </div>

        <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Direct charges run on the connected account. The platform collects a sample application fee ({applicationFeePreview}) to
          demonstrate monetisation.
        </p>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="priceId" value={product.defaultPriceId} />

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Quantity</span>
          <input
            name="quantity"
            type="number"
            min={1}
            max={25}
            value={quantity}
            onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
            className="w-24 rounded border border-input px-2 py-1 text-sm"
          />
        </label>

        <SubmitButton>Checkout with Stripe</SubmitButton>
  {isRedirecting ? <p className="text-xs text-slate-500">Opening Stripe Checkout…</p> : null}
        {state?.message ? (
          <p className={`text-xs ${state.success ? "text-emerald-600" : "text-rose-600"}`}>{state.message}</p>
        ) : null}
      </form>
    </article>
  );
}

export function Storefront({ accountId, products, successSession }: StorefrontProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Storefront</h2>
        <p className="text-sm text-slate-600">
          This page emulates what the connected salon&apos;s customers would see. Under the hood we pass the Stripe connected account
          id via the request header so inventory and payments are scoped correctly.
        </p>
      </div>

      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        The account id appears in the URL purely for demo purposes (<code>{accountId}</code>). In a real marketplace you should
        route customers by a friendly slug or domain, then resolve the connected account id server-side.
      </p>

      {successSession ? (
        <div className="space-y-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-medium">Payment successful!</p>
          <p>
            Stripe session <code>{successSession.sessionId}</code>{" "}
            {successSession.amountTotal != null && successSession.currency ? (
              <>completed for {centsToCurrency(successSession.amountTotal, successSession.currency)}.</>
            ) : (
              "completed successfully. Check the Stripe dashboard for the final amount."
            )}
          </p>
        </div>
      ) : null}

      {products.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {products.map((product) => (
            <ProductCheckoutCard key={product.productId} accountId={accountId} product={product} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          This connected account does not have any active products yet. Ask the platform admin to create one from the demo dashboard.
        </p>
      )}
    </div>
  );
}
