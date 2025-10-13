"use server";

import Stripe from "stripe";

import prisma from "@/db";
import { getStripeServerClient } from "@/lib/stripe";
import { ensureAbsoluteStripeUrl, resolveStripePlatformBaseUrl } from "@/lib/services/stripe-utils";

type StripeAccountStatusValue = "active" | "pending" | "restricted";

export interface StripeAccountRequirementsSummary {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
}

export interface StripeAccountSnapshot {
  accountId: string;
  email?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: StripeAccountStatusValue;
  requirements: StripeAccountRequirementsSummary;
}

interface SalonStripeSelection {
  id: string;
  slug: string;
  stripeAccountId: string | null;
  stripeOnboardedAt: Date | null;
  stripeAccountStatus: string | null;
}

function mapAccountToSnapshot(account: Stripe.Account): StripeAccountSnapshot {
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const requirements = account.requirements ?? {};
  const currentlyDue = requirements.currently_due ?? [];
  const status: StripeAccountStatusValue =
    chargesEnabled && payoutsEnabled && currentlyDue.length === 0
      ? "active"
      : requirements.disabled_reason
        ? "restricted"
        : "pending";

  return {
    accountId: account.id,
    email: account.email,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted: account.details_submitted ?? false,
    status,
    requirements: {
      currentlyDue,
      eventuallyDue: requirements.eventually_due ?? [],
      pastDue: requirements.past_due ?? [],
      pendingVerification: requirements.pending_verification ?? [],
      disabledReason: requirements.disabled_reason ?? null,
    },
  };
}

async function getSalonStripeSelection(salonId: string): Promise<SalonStripeSelection> {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: {
      id: true,
      slug: true,
      stripeAccountId: true,
      stripeOnboardedAt: true,
      stripeAccountStatus: true,
    },
  });

  if (!salon) {
    throw new Error("Salon not found.");
  }

  return salon;
}

async function applySnapshotToSalon(
  salon: SalonStripeSelection,
  snapshot: StripeAccountSnapshot
): Promise<void> {
  const shouldSetOnboardedAt = snapshot.detailsSubmitted && !salon.stripeOnboardedAt;

  await prisma.salon.update({
    where: { id: salon.id },
    data: {
      stripeAccountId: snapshot.accountId,
      stripeAccountStatus: snapshot.status,
      stripeChargesEnabled: snapshot.chargesEnabled,
      stripePayoutsEnabled: snapshot.payoutsEnabled,
      stripeRequirementsDue: snapshot.requirements.currentlyDue,
      stripeOnboardedAt: shouldSetOnboardedAt ? new Date() : undefined,
      updatedAt: new Date(),
    },
  });
}

export async function createConnectedAccountForSalon(
  salonId: string,
  email?: string | null,
  businessUrl?: string | null
): Promise<StripeAccountSnapshot> {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: {
      id: true,
      slug: true,
      stripeAccountId: true,
      stripeOnboardedAt: true,
    },
  });

  if (!salon) {
    throw new Error("Salon not found.");
  }

  if (salon.stripeAccountId) {
    throw new Error("This salon already has a connected Stripe account.");
  }

  const stripe = getStripeServerClient();

  const account = await stripe.accounts.create({
    email: email ?? undefined,
    business_profile: businessUrl ? { url: businessUrl } : undefined,
    controller: {
      fees: { payer: "account" },
      losses: { payments: "stripe" },
      stripe_dashboard: { type: "full" },
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const snapshot = mapAccountToSnapshot(account);

  await prisma.salon.update({
    where: { id: salonId },
    data: {
      stripeAccountId: snapshot.accountId,
      stripeAccountStatus: snapshot.status,
      stripeChargesEnabled: snapshot.chargesEnabled,
      stripePayoutsEnabled: snapshot.payoutsEnabled,
      stripeRequirementsDue: snapshot.requirements.currentlyDue,
      stripeOnboardedAt: snapshot.detailsSubmitted ? new Date() : null,
    },
  });

  return snapshot;
}

export async function generateOnboardingLink(
  salonId: string,
  refreshUrl?: string,
  returnUrl?: string
): Promise<string> {
  const salon = await getSalonStripeSelection(salonId);

  if (!salon.stripeAccountId) {
    throw new Error("Salon has not been associated with a Stripe account yet.");
  }

  const stripe = getStripeServerClient();
  const baseUrl = resolveStripePlatformBaseUrl();

  const refresh =
    refreshUrl ??
    `/onboarding/payment-setup?salon=${encodeURIComponent(salon.slug)}&refresh=1`;
  const complete =
    returnUrl ??
    `/onboarding/payment-setup?salon=${encodeURIComponent(salon.slug)}&onboarded=1`;

  const accountLink = await stripe.accountLinks.create({
    account: salon.stripeAccountId,
    refresh_url: ensureAbsoluteStripeUrl(refresh, baseUrl),
    return_url: ensureAbsoluteStripeUrl(complete, baseUrl),
    type: "account_onboarding",
  });

  return accountLink.url;
}

export async function syncAccountStatus(salonId: string): Promise<StripeAccountSnapshot> {
  const salon = await getSalonStripeSelection(salonId);

  if (!salon.stripeAccountId) {
    throw new Error("Salon is not connected to a Stripe account.");
  }

  const stripe = getStripeServerClient();
  const account = await stripe.accounts.retrieve(salon.stripeAccountId);
  const snapshot = mapAccountToSnapshot(account);

  await applySnapshotToSalon(salon, snapshot);

  return snapshot;
}

export async function isAccountReadyForPayments(salonId: string): Promise<boolean> {
  const salon = await getSalonStripeSelection(salonId);

  if (!salon.stripeAccountId) {
    return false;
  }

  const cached = await prisma.salon.findUnique({
    where: { id: salon.id },
    select: {
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeRequirementsDue: true,
    },
  });

  if (
    cached?.stripeChargesEnabled &&
    cached?.stripePayoutsEnabled &&
    (cached?.stripeRequirementsDue?.length ?? 0) === 0
  ) {
    return true;
  }

  const snapshot = await syncAccountStatus(salonId);
  return (
    snapshot.chargesEnabled &&
    snapshot.payoutsEnabled &&
    snapshot.requirements.currentlyDue.length === 0
  );
}

export async function getAccountRequirements(
  salonId: string
): Promise<StripeAccountRequirementsSummary> {
  const snapshot = await syncAccountStatus(salonId);
  return snapshot.requirements;
}
