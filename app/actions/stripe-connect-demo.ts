"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertConnectedAccountId, getStripeServerClient } from "@/lib/stripe";
import {
  AccountSummary,
  CheckoutSessionSummary,
  ProductSummary,
  toAccountSummary,
} from "@/lib/stripe-connect";

/** Shared shape for form action responses rendered back into UI components. */
export interface ActionResult<TData = unknown> {
  success: boolean;
  message: string;
  data?: TData;
}

const accountCreationSchema = z.object({
  email: z
    .string()
    .email("Emails must be valid")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  businessProfileUrl: z
    .string()
    .url("Enter a valid website URL")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
});

const onboardingSchema = z.object({
  accountId: z.string().min(1, "Account id is required"),
});

const productCreationSchema = z.object({
  accountId: z.string().min(1, "Account id is required"),
  name: z.string().min(3, "Product name must contain at least 3 characters"),
  description: z.string().optional(),
  currency: z
    .string()
    .default("aud")
    .transform((value) => value.toLowerCase()),
  amount: z
    .string()
    .transform((value) => Number.parseFloat(value))
    .pipe(z.number().positive("Enter a positive amount")),
});

const checkoutSchema = z.object({
  accountId: z.string().min(1, "Account id is required"),
  priceId: z.string().min(1, "Stripe price id is required"),
  quantity: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 1))
    .pipe(z.number().int().positive("Quantity must be a positive integer")),
});

function getPlatformBaseUrl(): string {
  /**
   * Configure STRIPE_PLATFORM_BASE_URL to match the domain that should receive Stripe redirects.
   * Example: https://dashboard.vernis.app
   * During local development you can use http://localhost:3000.
   */
  const baseUrl =
    process.env.STRIPE_PLATFORM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  if (!baseUrl) {
    throw new Error(
      "Set STRIPE_PLATFORM_BASE_URL (or NEXT_PUBLIC_APP_URL) so Stripe knows where to send users after onboarding/checkout."
    );
  }

  return baseUrl.replace(/\/$/, "");
}

function formatCurrencyToMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export async function createConnectedAccount(
  _prevState: ActionResult<{ account: AccountSummary }> | undefined,
  formData: FormData
): Promise<ActionResult<{ account: AccountSummary }>> {
  try {
    const input = accountCreationSchema.parse({
      email: formData.get("email"),
      businessProfileUrl: formData.get("businessProfileUrl"),
    });

    const stripe = getStripeServerClient();

    const account = await stripe.accounts.create({
      email: input.email,
      business_profile: input.businessProfileUrl
        ? { url: input.businessProfileUrl }
        : undefined,
      /**
       * Controller settings follow the requirements from the product brief.
       * We do not pass a top-level `type` property: controller covers responsibilities.
       */
      controller: {
        fees: {
          payer: "account",
        },
        losses: {
          payments: "stripe",
        },
        stripe_dashboard: {
          type: "full",
        },
      },
      /**
       * Request the capabilities typically required for direct charges.
       * Stripe will prompt the connected account for the information needed to activate them.
       */
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return {
      success: true,
      message: "Connected account created. Save the acct_ identifier for onboarding.",
      data: { account: toAccountSummary(account) },
    };
  } catch (error) {
    console.error("Failed to create connected account", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create connected account. Check the server logs for more details.",
    };
  }
}

export async function generateOnboardingLink(
  _prevState: ActionResult<{ url: string }> | undefined,
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  try {
    const input = onboardingSchema.parse({
      accountId: formData.get("accountId"),
    });

    const accountId = assertConnectedAccountId(input.accountId);
    const stripe = getStripeServerClient();

    const baseUrl = getPlatformBaseUrl();

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/connect-demo?accountId=${encodeURIComponent(accountId)}`,
      return_url: `${baseUrl}/connect-demo?accountId=${encodeURIComponent(accountId)}&onboarded=true`,
      type: "account_onboarding",
    });

    return {
      success: true,
      message: "Redirect the user to complete onboarding.",
      data: { url: accountLink.url },
    };
  } catch (error) {
    console.error("Failed to create account onboarding link", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate onboarding link. Check the server logs for more details.",
    };
  }
}

export async function retrieveAccountStatus(
  _prevState: ActionResult<{ account: AccountSummary }> | undefined,
  formData: FormData
): Promise<ActionResult<{ account: AccountSummary }>> {
  try {
    const input = onboardingSchema.parse({
      accountId: formData.get("accountId"),
    });

    const accountId = assertConnectedAccountId(input.accountId);
    const stripe = getStripeServerClient();

    const account = await stripe.accounts.retrieve(accountId);

    return {
      success: true,
      message: "Fetched account status directly from Stripe (not cached).",
      data: { account: toAccountSummary(account) },
    };
  } catch (error) {
    console.error("Failed to retrieve account status", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to retrieve account status. Check the server logs for more details.",
    };
  }
}

export async function createConnectedProduct(
  _prevState: ActionResult<{ product: ProductSummary }> | undefined,
  formData: FormData
): Promise<ActionResult<{ product: ProductSummary }>> {
  try {
    const input = productCreationSchema.parse({
      accountId: formData.get("accountId"),
      name: formData.get("name"),
      description: formData.get("description"),
      currency: formData.get("currency"),
      amount: formData.get("amount"),
    });

    const accountId = assertConnectedAccountId(input.accountId);
    const stripe = getStripeServerClient();

    const unitAmount = formatCurrencyToMinorUnits(input.amount);

    const product = await stripe.products.create(
      {
        name: input.name,
        description: input.description,
        /**
         * Default price data allows the storefront to rely on the generated price id.
         */
        default_price_data: {
          currency: input.currency,
          unit_amount: unitAmount,
        },
      },
      {
        /**
         * `stripeAccount` ensures the request uses the connected account header (a.k.a. Stripe-Account).
         */
        stripeAccount: accountId,
      }
    );

    revalidatePath(`/connect-demo?accountId=${accountId}`);

    const defaultPriceId =
      typeof product.default_price === "string" ? product.default_price : product.default_price?.id;
    const defaultPrice =
      typeof product.default_price === "string" ? null : product.default_price;

    if (!defaultPriceId) {
      throw new Error(
        "Stripe did not return a default price id. Ensure the product is created with default_price_data and try again."
      );
    }

    return {
      success: true,
      message: "Product created on the connected account.",
      data: {
        product: {
          productId: product.id,
          defaultPriceId,
          name: product.name,
          description: product.description,
          currency: defaultPrice?.currency ?? input.currency,
          unitAmount: defaultPrice?.unit_amount ?? unitAmount,
        },
      },
    };
  } catch (error) {
    console.error("Failed to create connected product", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create product. Check the server logs for more details.",
    };
  }
}

export async function createCheckoutSession(
  _prevState: ActionResult<{ session: CheckoutSessionSummary }> | undefined,
  formData: FormData
): Promise<ActionResult<{ session: CheckoutSessionSummary }>> {
  try {
    const input = checkoutSchema.parse({
      accountId: formData.get("accountId"),
      priceId: formData.get("priceId"),
      quantity: formData.get("quantity"),
    });

    const accountId = assertConnectedAccountId(input.accountId);
    const stripe = getStripeServerClient();

    const price = await stripe.prices.retrieve(
      input.priceId,
      {
        expand: ["product"],
      },
      {
        stripeAccount: accountId,
      }
    );

    if (!price.unit_amount) {
      throw new Error("The default price is missing a unit amount. Create the product with default_price_data.");
    }

    const baseUrl = getPlatformBaseUrl();

    const applicationFeeAmount = Math.max(50, Math.floor(price.unit_amount * 0.1));

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price: price.id,
            quantity: input.quantity,
          },
        ],
        payment_intent_data: {
          /**
           * Sample monetisation: the platform collects ~10% with a $0.50 minimum application fee.
           * Adjust logic to match business requirements.
           */
          application_fee_amount: applicationFeeAmount,
        },
        success_url: `${baseUrl}/connect-demo/${encodeURIComponent(accountId)}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/connect-demo/${encodeURIComponent(accountId)}?canceled=true`,
      },
      {
        /**
         * Direct charges run on the connected account. The platform header is required.
         */
        stripeAccount: accountId,
      }
    );

    return {
      success: true,
      message: "Checkout session created. Redirect the buyer to Stripe Checkout.",
      data: {
        session: {
          sessionId: session.id,
          url: session.url,
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? price.currency ?? null,
        },
      },
    };
  } catch (error) {
    console.error("Failed to create checkout session", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create checkout session. Check the server logs for more details.",
    };
  }
}

/**
 * Server helper used by the storefront page to fetch products with embedded pricing information.
 * This reads Stripe directly so results stay fresh without platform storage.
 */
export async function listConnectedProducts(accountId: string): Promise<ProductSummary[]> {
  const verifiedAccountId = assertConnectedAccountId(accountId);
  const stripe = getStripeServerClient();

  const products = await stripe.products.list(
    {
      limit: 20,
      expand: ["data.default_price"],
    },
    {
      stripeAccount: verifiedAccountId,
    }
  );

  const summaries: ProductSummary[] = [];

  for (const product of products.data) {
    /**
     * Skip archived entries so the storefront stays focused on the current catalog.
     * Feel free to extend this with pagination or inventory metadata for real marketplaces.
     */
    if (!product.active) {
      continue;
    }

    const defaultPrice = typeof product.default_price === "string" ? null : product.default_price;

    if (!defaultPrice?.id || defaultPrice.unit_amount == null) {
      // Stripe products can exist without prices. This guard keeps the frontend logic simple.
      continue;
    }

    summaries.push({
      productId: product.id,
      defaultPriceId: defaultPrice.id,
      name: product.name,
      description: product.description,
      currency: defaultPrice.currency,
      unitAmount: defaultPrice.unit_amount,
    });
  }

  return summaries;
}

/**
 * Helper for hydrating a checkout session when the buyer returns to the platform.
 */
export async function retrieveCheckoutSession(accountId: string, sessionId: string): Promise<CheckoutSessionSummary> {
  const verifiedAccountId = assertConnectedAccountId(accountId);
  const stripe = getStripeServerClient();

  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {
      expand: ["line_items", "line_items.data.price", "line_items.data.price.product"],
    },
    {
      stripeAccount: verifiedAccountId,
    }
  );

  /**
   * Only the fields used by the demo storefront are returned. Expand this shape if you need more metadata client-side.
   */
  return {
    sessionId: session.id,
    url: session.url,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
  };
}
