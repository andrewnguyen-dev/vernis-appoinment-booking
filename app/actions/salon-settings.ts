"use server";

import { z } from "zod";
import prisma from "@/db";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import { revalidatePath } from "next/cache";
import {
  updateSalonSchema,
  type UpdateSalonData,
} from "@/helpers/zod/salon-schemas";

// Helper function to get user's salon
async function getOwnerSalonOrThrow(userId: string) {
  const salon = await getUserSalon(userId, "OWNER");
  if (!salon) {
    throw new Error("No salon found for user");
  }
  return salon;
}

// Get salon settings
export async function getSalonSettings() {
  try {
    const session = await requireOwnerAuth();
    const salon = await getOwnerSalonOrThrow(session.user.id);

    return {
      success: true,
      data: {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        timeZone: salon.timeZone,
        logoUrl: salon.logoUrl,
        capacity: salon.capacity,
        customDomain: salon.customDomain,
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
export async function updateSalonSettings(data: UpdateSalonData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = updateSalonSchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Check if slug is unique (excluding current salon)
    if (validatedData.slug !== salon.slug) {
      const existingSalon = await prisma.salon.findUnique({
        where: { slug: validatedData.slug },
      });

      if (existingSalon) {
        return {
          success: false,
          error: "This salon URL is already taken. Please choose a different one.",
        };
      }
    }

    // Check if custom domain is unique (excluding current salon)
    if (validatedData.customDomain && validatedData.customDomain !== salon.customDomain) {
      const existingDomain = await prisma.salon.findUnique({
        where: { customDomain: validatedData.customDomain },
      });

      if (existingDomain) {
        return {
          success: false,
          error: "This custom domain is already in use. Please choose a different one.",
        };
      }
    }

    // Update the salon
    const updatedSalon = await prisma.salon.update({
      where: { id: salon.id },
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        timeZone: validatedData.timeZone,
        logoUrl: validatedData.logoUrl || null,
        capacity: validatedData.capacity,
        customDomain: validatedData.customDomain || null,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: updatedSalon,
      message: "Salon settings updated successfully!",
    };
  } catch (error) {
    console.error("Failed to update salon settings:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid data provided",
        details: error.issues,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update salon settings",
    };
  }
}
