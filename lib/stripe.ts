import Stripe from 'stripe';

/**
 * Returns a configured Stripe client for server-side usage.
 * The API version is locked to the 2025-08-27.basil release to ensure predictable behavior.
 *
 * IMPORTANT: Replace the placeholder environment variable below with your real Stripe secret key.
 * We intentionally throw a descriptive error when the value is missing so developers spot setup issues early.
 */
export function getStripeServerClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    /**
     * Developers should define STRIPE_SECRET_KEY in their environment before running the sample.
     * Example: export STRIPE_SECRET_KEY="sk_live_..." (never commit secrets to source control).
     */
    throw new Error(
      'Missing STRIPE_SECRET_KEY. Set STRIPE_SECRET_KEY in your environment with a valid Stripe secret key before using the Connect demo.'
    );
  }

  return new Stripe(secretKey, {
    /**
     * Using the latest Stripe API version requested in the brief.
     * See https://docs.stripe.com/api/versioning for release details.
     */
    apiVersion: '2025-08-27.basil',
  });
}

/**
 * Helper that validates a connected account id before making API calls using the account header.
 * The UI passes the id that the platform admin enters manually in this sample.
 */
export function assertConnectedAccountId(accountId: string | null | undefined): string {
  if (!accountId) {
    throw new Error('A connected account id is required. Enter the acct_... identifier shown after onboarding.');
  }

  if (!accountId.startsWith('acct_')) {
    throw new Error('Connected account ids start with "acct_". Double-check the value you pasted.');
  }

  return accountId;
}
