# Stripe Connect Demo Walkthrough

This guide explains how to exercise the Stripe Connect sample that now ships with Vernis. The demo intentionally keeps state in memory and reads everything directly from Stripe so you can understand each API call end to end.

## Prerequisites

1. **Stripe API keys**
   - Set `STRIPE_SECRET_KEY` in your environment. Use a test key that begins with `sk_test_`. The sample throws a descriptive error if the value is missing.
   - Optional but recommended: set `STRIPE_PLATFORM_BASE_URL`. During local development you can use `http://localhost:3000`. The helper falls back to `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` if present.
2. Install dependencies and run the app:

```bash
npm install
npm run dev
```

> 💡 The demo locks the Stripe API version to `2025-08-27.basil` so responses remain consistent.

## Platform flow (`/connect-demo`)

The dashboard walks you through every Connect step:

1. **Create a connected account**
   - Submits `stripe.accounts.create` with the required `controller` properties.
   - The response displays the new `acct_` id. Copy it for later steps.

2. **Onboard to collect payments**
   - Enter the `acct_` id and click “Onboard to collect payments”.
   - The action creates an Account Link with the configured refresh/return URLs and redirects you to Stripe’s onboarding flow.
   - When Stripe sends you back, click “Refresh status from Stripe” to fetch the latest requirements directly from the API.

3. **Create products on the connected account**
   - Provide a service name, description, price, and currency.
   - The action calls `stripe.products.create` with `default_price_data` and passes the `Stripe-Account` header (via `stripeAccount`) so data lands on the connected account.
   - After creation the UI surfaces a shareable storefront link: `/connect-demo/{acct_…}`. In production you should swap the raw account id for a salon slug.

4. **Review live products**
   - When an `accountId` query parameter is present the dashboard lists the connected account’s products by calling `stripe.products.list`. Errors (for example an invalid key) surface inline.

## Storefront flow (`/connect-demo/[accountId]`)

This public-facing page pretends to be the client’s storefront:

1. **Load inventory**
   - Uses the same `Stripe-Account` header to fetch products for the specified account.
2. **Initiate checkout**
   - Each product form posts to a server action that creates a Stripe Checkout session in direct charge mode.
   - The platform collects an application fee equal to 10% of the item price (minimum 50 cents) to illustrate monetisation.
3. **Handle success**
   - When the buyer returns with `session_id`, the page pulls the checkout session directly from Stripe and shows a confirmation banner.

> ⚠️ For clarity the storefront route still exposes the raw `acct_` id. Always resolve the connected account server-side from a friendly identifier before going live.

## Error handling

- Missing environment variables (`STRIPE_SECRET_KEY`, `STRIPE_PLATFORM_BASE_URL`) throw descriptive errors before any API call is attempted.
- Invalid or missing account ids surface inline and never reach Stripe.
- When Stripe returns an error (for example due to incomplete onboarding) the UI shows the message and encourages you to inspect the logs.

## Next steps

- Replace the simple Tailwind UI with production-ready components.
- Persist connected account status and products in your database so salon owners can manage inventory without re-fetching from Stripe every time.
- Wire Stripe webhooks to receive onboarding and payout updates automatically.
