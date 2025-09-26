"use server";

import { z } from "zod";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import prisma from "@/db";
import { stripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";

const stripeConnectSchema = z.object({
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
});

/**
 * Generates a Stripe Connect authorization URL for salon owners to connect their Stripe account
 * Returns the URL instead of redirecting to allow client-side handling
 */
export async function createStripeConnectLink(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const session = await requireOwnerAuth();
    const salon = await getUserSalon(session.user.id, "OWNER");
    
    if (!salon) {
      return { success: false, error: "Salon not found" };
    }

    const rawData = {
      refreshUrl: formData.get("refreshUrl") as string,
      returnUrl: formData.get("returnUrl") as string,
    };
    console.log("🚀 ~ createStripeConnectLink ~ rawData:", rawData)

    const validatedData = stripeConnectSchema.parse(rawData);
    console.log("🚀 ~ createStripeConnectLink ~ validatedData:", validatedData)

    // Check if Stripe is properly configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return { success: false, error: "Stripe is not properly configured. Missing secret key." };
    }

    // Check if salon already has a Stripe account connected
    if (salon.stripeAccountId) {
      console.log("🚀 ~ salon already has stripeAccountId:", salon.stripeAccountId)
      // If account exists, create login link instead
      const loginLink = await stripe.accounts.createLoginLink(salon.stripeAccountId);
      console.log("🚀 ~ createStripeConnectLink ~ loginLink.url:", loginLink.url)
      return { success: true, url: loginLink.url };
    }

    console.log("🚀 ~ Creating new Stripe Express account for user:", session.user.email)

    // Create a new Stripe account for the salon
    const account = await stripe.accounts.create({
      type: "express",
      country: "AU", // Australia as per business context
      email: session.user.email,
      business_type: "individual", // Default to individual, can be updated later
      metadata: {
        salon_id: salon.id,
        user_id: session.user.id,
      },
    });

    console.log("🚀 ~ Created Stripe account:", account.id)

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: validatedData.refreshUrl,
      return_url: validatedData.returnUrl,
      type: "account_onboarding",
    });

    // Store the Stripe account ID in our database
    await prisma.salon.update({
      where: { id: salon.id },
      data: {
        stripeAccountId: account.id,
      },
    });

    console.log("🚀 ~ createStripeConnectLink ~ accountLink.url:", accountLink.url)
    return { success: true, url: accountLink.url };
  } catch (error) {
    console.error("Error creating Stripe Connect link:", error);
    
    // Handle specific Stripe errors
    if (error instanceof stripe.errors.StripeError) {
      switch (error.type) {
        case 'StripeAuthenticationError':
          return { success: false, error: "Stripe authentication failed. Please check your API keys." };
        case 'StripeRateLimitError':
          return { success: false, error: "Too many requests. Please try again in a moment." };
        case 'StripeInvalidRequestError':
          console.error("Invalid request error:", error.message);
          return { success: false, error: `Invalid request: ${error.message}` };
        case 'StripeAPIError':
          return { success: false, error: "Stripe API error occurred. Please try again." };
        case 'StripeConnectionError':
          return { success: false, error: "Connection error. Please check your internet connection." };
        default:
          console.error("Stripe error details:", { type: error.type, message: error.message, code: error.code });
          return { success: false, error: `Stripe error: ${error.message}` };
      }
    }
    
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid URL parameters provided" };
    }
    
    // Log the full error for debugging
    console.error("Unexpected error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    
    return { success: false, error: "Failed to create Stripe Connect link. Please try again." };
  }
}

/**
 * Checks the status of a salon's Stripe Connect account
 */
export async function getStripeAccountStatus() {
  const session = await requireOwnerAuth();
  const salon = await getUserSalon(session.user.id, "OWNER");
  
  if (!salon) {
    throw new Error("Salon not found");
  }

  if (!salon.stripeAccountId) {
    return { connected: false, status: null };
  }

  try {
    const account = await stripe.accounts.retrieve(salon.stripeAccountId);
    
    const connected = account.charges_enabled && account.payouts_enabled;
    const status = connected ? "ACTIVE" : "PENDING";

    return {
      connected,
      status,
      account: {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
      },
    };
  } catch (error) {
    console.error("Error checking Stripe account status:", error);
    return { connected: false, status: "ERROR" };
  }
}

/**
 * Creates a Stripe Connect login link for salon owners to manage their account
 * Returns the URL instead of redirecting to allow client-side handling
 */
export async function createStripeLoginLink(): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const session = await requireOwnerAuth();
    const salon = await getUserSalon(session.user.id, "OWNER");
    
    if (!salon) {
      return { success: false, error: "Salon not found" };
    }

    if (!salon.stripeAccountId) {
      return { success: false, error: "No Stripe account connected" };
    }

    const loginLink = await stripe.accounts.createLoginLink(salon.stripeAccountId);
    return { success: true, url: loginLink.url };
  } catch (error) {
    console.error("Error creating Stripe login link:", error);
    return { success: false, error: "Failed to create Stripe login link. Please try again." };
  }
}

/**
 * Disconnects a salon's Stripe account
 */
export async function disconnectStripeAccount() {
  const session = await requireOwnerAuth();
  const salon = await getUserSalon(session.user.id, "OWNER");
  
  if (!salon) {
    throw new Error("Salon not found");
  }

  if (!salon.stripeAccountId) {
    throw new Error("No Stripe account connected");
  }

  try {
    // Note: We don't actually delete the Stripe account as it may have payment history
    // Instead, we just remove our reference to it
    await prisma.salon.update({
      where: { id: salon.id },
      data: {
        stripeAccountId: null,
      },
    });

    revalidatePath("/owner/settings");
    return { success: true };
  } catch (error) {
    console.error("Error disconnecting Stripe account:", error);
    throw new Error("Failed to disconnect Stripe account. Please try again.");
  }
}