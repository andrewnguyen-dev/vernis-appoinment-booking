"use server";

import { z } from "zod";
import prisma from "@/db";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getOwnerSalonOrThrow } from "@/lib/user-utils";
import { buildSalonSettingsInitialValues } from "@/lib/salon-settings";
import { persistSalonSettings } from "@/lib/services/persist-salon-settings";
import { SALON_SETTINGS_REVALIDATE_PATHS } from "@/lib/constants/salon-settings";
import { revalidatePath } from "next/cache";
import { type DayOfWeekValue, type OwnerOnboardingInput } from "@/helpers/zod/onboarding-schemas";

interface SalonSettingsActionResult {
  success: boolean;
  data?: { values: OwnerOnboardingInput };
  message?: string;
  error?: string;
  fieldErrors?: Partial<Record<keyof OwnerOnboardingInput, string>>;
}

// Get salon settings
export async function getSalonSettings() {
  try {
    const session = await requireOwnerAuth();
    const salon = await getOwnerSalonOrThrow(session.user.id);
    const businessHours = await prisma.businessHours.findMany({
      where: { salonId: salon.id },
    });

    const initialValues = buildSalonSettingsInitialValues(
      {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        timeZone: salon.timeZone,
        capacity: salon.capacity,
        logoUrl: salon.logoUrl,
        customDomain: salon.customDomain,
      },
      businessHours.map((hours) => ({
        dayOfWeek: hours.dayOfWeek as DayOfWeekValue,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        isClosed: hours.isClosed,
      })),
    );

    return {
      success: true,
      data: {
        initialValues,
        ownerName: session.user.name,
      },
    };
  } catch (error) {
    console.error("Failed to get salon settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load salon settings",
    };
  }
}

// Update salon settings
export async function updateSalonSettings(data: OwnerOnboardingInput): Promise<SalonSettingsActionResult> {
  try {
    const session = await requireOwnerAuth();
    const result = await persistSalonSettings(session.user.id, data);

    SALON_SETTINGS_REVALIDATE_PATHS.forEach((path) => {
      revalidatePath(path);
    });

    return {
      success: true,
      data: { values: result.values },
      message: "Salon settings updated successfully!",
    };
  } catch (error) {
    console.error("Failed to update salon settings:", error);

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

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update salon settings",
    };
  }
}
