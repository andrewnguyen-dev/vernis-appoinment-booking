"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
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
 */
export async function createStripeConnectLink(formData: FormData) {
  const session = await requireOwnerAuth();
  const salon = await getUserSalon(session.user.id, "OWNER");
  
  if (!salon) {
    throw new Error("Salon not found");
  }

  const rawData = {
    refreshUrl: formData.get("refreshUrl") as string,
    returnUrl: formData.get("returnUrl") as string,
  };

  const validatedData = stripeConnectSchema.parse(rawData);

  try {
    // Check if salon already has a Stripe account connected
    if (salon.stripeAccountId) {
      // If account exists, create login link instead
      const loginLink = await stripe.accounts.createLoginLink(salon.stripeAccountId);
      redirect(loginLink.url);
    }

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

    redirect(accountLink.url);
  } catch (error) {
    console.error("Error creating Stripe Connect link:", error);
    throw new Error("Failed to create Stripe Connect link. Please try again.");
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
 */
export async function createStripeLoginLink() {
  const session = await requireOwnerAuth();
  const salon = await getUserSalon(session.user.id, "OWNER");
  
  if (!salon) {
    throw new Error("Salon not found");
  }

  if (!salon.stripeAccountId) {
    throw new Error("No Stripe account connected");
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(salon.stripeAccountId);
    redirect(loginLink.url);
  } catch (error) {
    console.error("Error creating Stripe login link:", error);
    throw new Error("Failed to create Stripe login link. Please try again.");
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