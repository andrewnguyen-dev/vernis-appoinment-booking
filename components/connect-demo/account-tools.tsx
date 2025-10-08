"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  ActionResult,
  createConnectedAccount,
  createConnectedProduct,
  generateOnboardingLink,
  retrieveAccountStatus,
} from "@/app/actions/stripe-connect-demo";
import { AccountSummary, ProductSummary } from "@/lib/stripe-connect";

/**
 * Walks platform operators through the Connect lifecycle one step at a time.
 * The surrounding UI keeps state to a minimum so developers can focus on the Stripe API calls.
 */
interface AccountToolsProps {
  initialAccountId?: string;
  initialAccountSummary?: AccountSummary | null;
}

const emptyAccountState: ActionResult<{ account: AccountSummary }> = { success: false, message: "" };
const emptyOnboardingState: ActionResult<{ url: string }> = { success: false, message: "" };
const emptyStatusState: ActionResult<{ account: AccountSummary }> = { success: false, message: "" };
const emptyProductState: ActionResult<{ product: ProductSummary }> = { success: false, message: "" };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Working..." : children}
    </button>
  );
}

function InfoBanner({
  state,
  successLabel = "Success",
  errorLabel = "Error",
}: {
  state?: ActionResult | null;
  successLabel?: string;
  errorLabel?: string;
}) {
  if (!state?.message) {
    return null;
  }

  const tone = state.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800";
  const label = state.success ? successLabel : errorLabel;

  return (
    <div className={`rounded border px-3 py-2 text-sm ${tone}`}>
      <span className="font-medium">{label}: </span>
      <span>{state.message}</span>
    </div>
  );
}

export function AccountTools({ initialAccountId, initialAccountSummary }: AccountToolsProps) {
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(initialAccountSummary ?? null);
  const [origin, setOrigin] = useState<string>("");
  const [redirecting, setRedirecting] = useState(false);

  const [accountState, accountAction] = useActionState(createConnectedAccount, emptyAccountState);
  const [onboardingState, onboardingAction] = useActionState(generateOnboardingLink, emptyOnboardingState);
  const [statusState, statusAction] = useActionState(retrieveAccountStatus, emptyStatusState);
  const [productState, productAction] = useActionState(createConnectedProduct, emptyProductState);

  useEffect(() => {
    // Capture the current origin so the shareable storefront link renders correctly during CSR hydration.
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    // When the platform creates a new account we prefill subsequent forms with the returned acct_ id.
    if (accountState?.success && accountState.data?.account.accountId) {
      setAccountId(accountState.data.account.accountId);
      setAccountSummary(accountState.data.account);
    }
  }, [accountState]);

  useEffect(() => {
    // Refreshing status replaces any locally cached data so the UI reflects Stripe's source of truth.
    if (statusState?.success && statusState.data?.account.accountId) {
      setAccountSummary(statusState.data.account);
    }
  }, [statusState]);

  useEffect(() => {
    // Stripe redirects the operator through the onboarding link. We flip a flag to show a "Redirecting" hint.
    if (onboardingState?.success && onboardingState.data?.url) {
      setRedirecting(true);
      window.location.href = onboardingState.data.url;
    }
  }, [onboardingState]);

  const requirementsList = useMemo(() => accountSummary?.requirementsDue ?? [], [accountSummary]);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-background px-6 py-5 shadow-sm">
        <header className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">1. Create a connected account</h2>
          <p className="text-sm text-muted-foreground">
            This calls <code>stripe.accounts.create</code> with the controller settings from the product brief.
          </p>
        </header>

        <form action={accountAction} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Optional inputs help Stripe prefill the onboarding flow. Leave them blank while testing.
          </p>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="email">
              Contact email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="owner@example.com"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="businessProfileUrl">
              Business website (optional)
            </label>
            <input
              id="businessProfileUrl"
              name="businessProfileUrl"
              type="url"
              placeholder="https://your-salon.example"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <SubmitButton>Create connected account</SubmitButton>
          <InfoBanner state={accountState} successLabel="Account created" />
          {accountState?.data?.account.accountId ? (
            <div className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-800">
              <p className="font-medium">Save this connected account id:</p>
              <code className="break-all">{accountState.data.account.accountId}</code>
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-lg border border-border bg-background px-6 py-5 shadow-sm">
        <header className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">2. Onboard to collect payments</h2>
          <p className="text-sm text-muted-foreground">
            Enter the connected account id (it always starts with <code>acct_</code>) to open Stripe&apos;s onboarding flow.
          </p>
        </header>

        <form action={onboardingAction} className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="accountId">
              Connected account id
            </label>
            <input
              id="accountId"
              name="accountId"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="acct_123..."
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <SubmitButton>Onboard to collect payments</SubmitButton>
          {redirecting ? (
            <p className="text-sm text-muted-foreground">Redirecting to Stripe...</p>
          ) : null}
          <InfoBanner state={onboardingState} successLabel="Open Stripe" />
        </form>

        <form action={statusAction} className="mt-6 space-y-4">
          <input type="hidden" name="accountId" value={accountId} />
          <SubmitButton>Refresh status from Stripe</SubmitButton>
          <InfoBanner state={statusState} successLabel="Latest status" />
        </form>

        <dl className="mt-4 grid gap-2 text-sm">
          <dt className="font-medium text-foreground">Current status</dt>
          {accountSummary ? (
            <div className="space-y-1 rounded bg-muted px-3 py-2">
              <p>
                <span className="font-medium">Charges enabled:</span> {accountSummary.chargesEnabled ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium">Payouts enabled:</span> {accountSummary.payoutsEnabled ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium">Dashboard email:</span> {accountSummary.email ?? "Not set"}
              </p>
              <div>
                <p className="font-medium">Outstanding requirements</p>
                {requirementsList.length ? (
                  <ul className="list-disc pl-5 text-xs">
                    {requirementsList.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs">No outstanding requirements 🎉</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Submit the refresh form to pull live information for the connected account.
            </p>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-background px-6 py-5 shadow-sm">
        <header className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">3. Create products for the connected account</h2>
          <p className="text-sm text-muted-foreground">
            Products are written directly to the connected account using the <code>Stripe-Account</code> header.
          </p>
        </header>

        <form action={productAction} className="grid gap-4">
          <input type="hidden" name="accountId" value={accountId} />
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productName">
              Product name
            </label>
            <input
              id="productName"
              name="name"
              required
              placeholder="Shellac Manicure"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productDescription">
              Description
            </label>
            <textarea
              id="productDescription"
              name="description"
              rows={3}
              placeholder="A long-lasting shellac manicure service."
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="productAmount">
                Price (in dollars)
              </label>
              <input
                id="productAmount"
                name="amount"
                required
                defaultValue="75"
                type="number"
                min="1"
                step="0.5"
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="productCurrency">
                Currency
              </label>
              <input
                id="productCurrency"
                name="currency"
                defaultValue="aud"
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm uppercase"
              />
            </div>
          </div>
          <SubmitButton>Create product</SubmitButton>
          <InfoBanner state={productState} successLabel="Product created" />
          {productState?.data?.product?.productId ? (
            <div className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-800">
              <p className="font-medium">Share this storefront URL with the connected account:</p>
              <code className="break-all">
                {origin ? `${origin}/connect-demo/${accountId || "acct_..."}` : "Generated at runtime"}
              </code>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}
