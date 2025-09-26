import Stripe from 'stripe';

// Initialize Stripe client with API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Use the default API version supported by this version of stripe-node
  typescript: true,
  appInfo: {
    name: 'Vernis Appointment Booking',
    version: '1.0.0',
    url: 'https://vernis.com',
  },
});

// Stripe Connect configuration
export const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID;

// Supported currencies (can be expanded later)
export const SUPPORTED_CURRENCIES = ['AUD', 'USD'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

// Stripe webhook endpoint secret
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Helper function to format cents to currency display
export function formatCents(cents: number, currency: SupportedCurrency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

// Helper function to calculate deposit amount
export function calculateDepositAmount(
  totalCents: number,
  depositType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'AUTHORIZATION_ONLY',
  depositValue: number
): number {
  switch (depositType) {
    case 'PERCENTAGE':
      return Math.round((totalCents * depositValue) / 10000); // depositValue is in basis points (e.g., 2000 = 20%)
    case 'FIXED_AMOUNT':
      return Math.min(depositValue, totalCents); // Don't charge more than total amount
    case 'AUTHORIZATION_ONLY':
      return 100; // $1.00 authorization
    default:
      return totalCents; // Fallback to full amount
  }
}

// Helper to validate Stripe Connect account
export async function validateStripeAccount(accountId: string): Promise<boolean> {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account.charges_enabled && account.payouts_enabled;
  } catch (error) {
    console.error('Error validating Stripe account:', error);
    return false;
  }
}