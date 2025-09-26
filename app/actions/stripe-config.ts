"use server";

import { z } from "zod";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import { stripeConnectConfigSchema, type StripeConnectConfigData } from "@/helpers/zod/stripe-schemas";
import prisma from "@/db";
import { revalidatePath } from "next/cache";

interface UpdateStripeConfigResult {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof StripeConnectConfigData, string>>;
}

export async function updateStripeConfig(data: StripeConnectConfigData): Promise<UpdateStripeConfigResult> {
  try {
    const session = await requireOwnerAuth();
    const salon = await getUserSalon(session.user.id, "OWNER");
    
    if (!salon) {
      return {
        success: false,
        error: "Salon not found",
      };
    }

    const validatedData = stripeConnectConfigSchema.parse(data);

    await prisma.salon.update({
      where: { id: salon.id },
      data: {
        depositType: validatedData.depositType,
        depositValue: validatedData.depositValue,
        depositDescription: validatedData.depositDescription,
        requireDeposit: validatedData.requireDeposit,
        updatedAt: new Date(),
      },
    });

    // Revalidate relevant paths
    revalidatePath("/owner/settings");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const flattened = error.flatten();
      const fieldErrors = flattened.fieldErrors as Partial<Record<keyof StripeConnectConfigData, string[]>>;

      return {
        success: false,
        error: "Please correct the highlighted errors.",
        fieldErrors: {
          depositType: fieldErrors.depositType?.[0],
          depositValue: fieldErrors.depositValue?.[0],
          depositDescription: fieldErrors.depositDescription?.[0],
          requireDeposit: fieldErrors.requireDeposit?.[0],
        },
      };
    }

    console.error("Failed to update Stripe configuration:", error);

    return {
      success: false,
      error: "Unexpected error while updating Stripe configuration. Please try again.",
    };
  }
}