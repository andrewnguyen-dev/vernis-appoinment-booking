"use server";

import { z } from "zod";
import prisma from "@/db";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import {
  ownerOnboardingSchema,
  type OwnerOnboardingInput,
} from "@/helpers/zod/onboarding-schemas";
import { revalidatePath } from "next/cache";

interface OwnerOnboardingResult {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof OwnerOnboardingInput, string>>;
}

export async function completeOwnerOnboarding(data: OwnerOnboardingInput): Promise<OwnerOnboardingResult> {
  try {
    const session = await requireOwnerAuth({ allowIncompleteOnboarding: true });
    const salon = await getUserSalon(session.user.id, "OWNER");

    if (!salon) {
      return {
        success: false,
        error: "Salon not found for this owner.",
      };
    }

    const validatedData = ownerOnboardingSchema.parse(data);

    if (validatedData.slug !== salon.slug) {
      const existingSalon = await prisma.salon.findUnique({
        where: { slug: validatedData.slug },
        select: { id: true },
      });

      if (existingSalon) {
        return {
          success: false,
          error: "This salon URL is already taken. Please choose a different one.",
          fieldErrors: {
            slug: "This salon URL is already taken. Please choose a different one.",
          },
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.salon.update({
        where: { id: salon.id },
        data: {
          name: validatedData.name,
          slug: validatedData.slug,
          timeZone: validatedData.timeZone,
          capacity: validatedData.capacity,
          hasCompletedOnboarding: true,
        },
      });

      for (const hours of validatedData.businessHours) {
        await tx.businessHours.upsert({
          where: {
            salonId_dayOfWeek: {
              salonId: salon.id,
              dayOfWeek: hours.dayOfWeek,
            },
          },
          update: {
            openTime: hours.openTime,
            closeTime: hours.closeTime,
            isClosed: hours.isClosed,
          },
          create: {
            salonId: salon.id,
            dayOfWeek: hours.dayOfWeek,
            openTime: hours.openTime,
            closeTime: hours.closeTime,
            isClosed: hours.isClosed,
          },
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/appointments");
    revalidatePath("/catalog");
    revalidatePath("/settings");
    revalidatePath("/staffs");
    revalidatePath("/clients");

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
