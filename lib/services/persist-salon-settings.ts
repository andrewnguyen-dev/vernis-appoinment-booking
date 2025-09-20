"use server";

import { z } from "zod";
import prisma from "@/db";
import { ownerOnboardingSchema, type OwnerOnboardingInput } from "@/helpers/zod/onboarding-schemas";
import { getUserSalon } from "@/lib/user-utils";

interface PersistSalonSettingsOptions {
  markOnboardingComplete?: boolean;
}

interface PersistSalonSettingsResult {
  salonId: string;
  values: OwnerOnboardingInput;
}

function normalizeOptionalField(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function persistSalonSettings(
  ownerId: string,
  rawValues: OwnerOnboardingInput,
  options: PersistSalonSettingsOptions = {},
): Promise<PersistSalonSettingsResult> {
  const salon = await getUserSalon(ownerId, "OWNER");

  if (!salon) {
    throw new Error("Salon not found for owner");
  }

  const validatedData = ownerOnboardingSchema.parse(rawValues);
  const normalizedLogoUrl = normalizeOptionalField(validatedData.logoUrl);
  const normalizedCustomDomain = normalizeOptionalField(validatedData.customDomain);

  if (validatedData.slug !== salon.slug) {
    const existingSalon = await prisma.salon.findUnique({
      where: { slug: validatedData.slug },
      select: { id: true },
    });

    if (existingSalon) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "This salon URL is already taken. Please choose a different one.",
          path: ["slug"],
        },
      ]);
    }
  }

  if (normalizedCustomDomain && normalizedCustomDomain !== salon.customDomain) {
    const existingDomain = await prisma.salon.findUnique({
      where: { customDomain: normalizedCustomDomain },
      select: { id: true },
    });

    if (existingDomain) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "This custom domain is already in use. Please choose a different one.",
          path: ["customDomain"],
        },
      ]);
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
        logoUrl: normalizedLogoUrl,
        customDomain: normalizedCustomDomain,
        hasCompletedOnboarding: options.markOnboardingComplete ? true : salon.hasCompletedOnboarding,
        updatedAt: new Date(),
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

  return {
    salonId: salon.id,
    values: {
      ...validatedData,
      logoUrl: normalizedLogoUrl ?? "",
      customDomain: normalizedCustomDomain ?? "",
    },
  };
}
