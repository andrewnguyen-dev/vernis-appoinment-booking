"use server";

import prisma from "@/db";
import { z } from "zod";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { persistSalonSettings } from "@/lib/services/persist-salon-settings";
import { SALON_SETTINGS_REVALIDATE_PATHS } from "@/lib/constants/salon-settings";
import { revalidatePath } from "next/cache";
import type { OwnerOnboardingInput } from "@/helpers/zod/onboarding-schemas";
import {
  createConnectedAccountForSalon,
  generateOnboardingLink,
  syncAccountStatus,
} from "@/lib/services/stripe-connect-service";

interface OwnerOnboardingResult {
  success: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<keyof OwnerOnboardingInput, string>>;
  data?: {
    requiresStripeOnboarding: boolean;
    salonId: string;
    salonSlug: string;
    stripeAccountId: string;
    stripeOnboardingUrl: string | null;
    accountStatus: string;
  };
}

export async function completeOwnerOnboarding(data: OwnerOnboardingInput): Promise<OwnerOnboardingResult> {
  try {
    const session = await requireOwnerAuth({ allowIncompleteOnboarding: true });
    const { salonId } = await persistSalonSettings(session.user.id, data);

    const salon = await prisma.salon.findUnique({
      where: { id: salonId },
      select: {
        id: true,
        slug: true,
        stripeAccountId: true,
        hasCompletedOnboarding: true,
      },
    });

    if (!salon) {
      throw new Error("Salon not found after saving settings.");
    }

    const customDomain = (data.customDomain ?? "").trim();
    const normalizedBusinessUrl = customDomain
      ? customDomain.startsWith("http")
        ? customDomain
        : `https://${customDomain}`
      : undefined;

    const accountSnapshot = salon.stripeAccountId
      ? await syncAccountStatus(salon.id)
      : await createConnectedAccountForSalon(salon.id, session.user.email ?? undefined, normalizedBusinessUrl);

    const accountReady =
      accountSnapshot.chargesEnabled &&
      accountSnapshot.payoutsEnabled &&
      accountSnapshot.requirements.currentlyDue.length === 0;

    let stripeOnboardingUrl: string | null = null;

    if (accountReady) {
      if (!salon.hasCompletedOnboarding) {
        await prisma.salon.update({
          where: { id: salon.id },
          data: { hasCompletedOnboarding: true },
        });
      }
    } else {
      stripeOnboardingUrl = await generateOnboardingLink(salon.id);

      if (salon.hasCompletedOnboarding) {
        await prisma.salon.update({
          where: { id: salon.id },
          data: { hasCompletedOnboarding: false },
        });
      }
    }

    SALON_SETTINGS_REVALIDATE_PATHS.forEach((path) => {
      revalidatePath(path);
    });
    revalidatePath("/onboarding/payment-setup");

    return {
      success: true,
      message: accountReady
        ? "Salon onboarding completed! You can now take bookings and payments."
        : "Salon details saved. Finish payment setup to start collecting payments.",
      data: {
        requiresStripeOnboarding: !accountReady,
        salonId: salon.id,
        salonSlug: salon.slug,
        stripeAccountId: accountSnapshot.accountId,
        stripeOnboardingUrl,
        accountStatus: accountSnapshot.status,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const flattened = error.flatten();
      const fieldErrors = flattened.fieldErrors as Partial<Record<keyof OwnerOnboardingInput, string[]>>;

      return {
        success: false,
        error: "Please correct the highlighted errors.",
        fieldErrors: {
          name: fieldErrors.name?.[0],
          slug: fieldErrors.slug?.[0],
          timeZone: fieldErrors.timeZone?.[0],
          capacity: fieldErrors.capacity?.[0],
          logoUrl: fieldErrors.logoUrl?.[0],
          customDomain: fieldErrors.customDomain?.[0],
          businessHours: fieldErrors.businessHours?.[0],
        },
      };
    }

    console.error("Failed to complete owner onboarding:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while completing onboarding. Please try again.";

    return {
      success: false,
      error: message,
    };
  }
}
