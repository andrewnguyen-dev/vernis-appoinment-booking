"use server";

import { z } from "zod";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { persistSalonSettings } from "@/lib/services/persist-salon-settings";
import { SALON_SETTINGS_REVALIDATE_PATHS } from "@/lib/constants/salon-settings";
import { revalidatePath } from "next/cache";
import type { OwnerOnboardingInput } from "@/helpers/zod/onboarding-schemas";

interface OwnerOnboardingResult {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof OwnerOnboardingInput, string>>;
}

export async function completeOwnerOnboarding(data: OwnerOnboardingInput): Promise<OwnerOnboardingResult> {
  try {
    const session = await requireOwnerAuth({ allowIncompleteOnboarding: true });
    await persistSalonSettings(session.user.id, data, { markOnboardingComplete: true });

    SALON_SETTINGS_REVALIDATE_PATHS.forEach((path) => {
      revalidatePath(path);
    });

    return { success: true };
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

    return {
      success: false,
      error: "Unexpected error while completing onboarding. Please try again.",
    };
  }
}
