import Stripe from "stripe";

/**
 * Shared summary view models used across the Connect demo.
 * Keeping them in a standalone module prevents Next.js from treating them as server actions.
 */
export interface AccountSummary {
  accountId: string;
  email?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
}

export interface ProductSummary {
  productId: string;
  defaultPriceId: string;
  name: string;
  currency: string;
  unitAmount: number;
  description?: string | null;
}

export interface CheckoutSessionSummary {
  sessionId: string;
  url: string | null;
  amountTotal: number | null;
  currency: string | null;
}

export function toAccountSummary(account: Stripe.Account): AccountSummary {
  return {
    accountId: account.id,
    email: account.email,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    requirementsDue: account.requirements?.currently_due ?? [],
  };
}
