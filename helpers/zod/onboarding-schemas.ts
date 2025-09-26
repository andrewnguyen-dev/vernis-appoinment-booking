import { z } from "zod";
import { updateSalonSchema } from "@/helpers/zod/salon-schemas";
import { stripeConnectConfigSchema } from "@/helpers/zod/stripe-schemas";

export const dayOfWeekValues = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type DayOfWeekValue = typeof dayOfWeekValues[number];

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const onboardingBusinessHourSchema = z.object({
  dayOfWeek: z.enum(dayOfWeekValues),
  isClosed: z.boolean(),
  openTime: z.string().regex(timeRegex, "Invalid time format"),
  closeTime: z.string().regex(timeRegex, "Invalid time format"),
}).superRefine((value, ctx) => {
  if (value.isClosed) {
    return;
  }

  if (value.openTime >= value.closeTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Close time must be after open time",
      path: ["closeTime"],
    });
  }
});

export const ownerOnboardingSchema = z.object({
  name: updateSalonSchema.shape.name,
  slug: updateSalonSchema.shape.slug,
  timeZone: updateSalonSchema.shape.timeZone,
  capacity: updateSalonSchema.shape.capacity,
  logoUrl: updateSalonSchema.shape.logoUrl,
  customDomain: updateSalonSchema.shape.customDomain,
  businessHours: z
    .array(onboardingBusinessHourSchema)
    .length(7, "Business hours must include all days of the week"),
}).superRefine((value, ctx) => {
  const seenDays = new Set<DayOfWeekValue>();

  for (const hours of value.businessHours) {
    if (seenDays.has(hours.dayOfWeek)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate day detected",
        path: ["businessHours"],
      });
      return;
    }

    seenDays.add(hours.dayOfWeek);
  }
});

// Extended onboarding schema that includes Stripe configuration
export const ownerOnboardingWithStripeSchema = z.object({
  name: updateSalonSchema.shape.name,
  slug: updateSalonSchema.shape.slug,
  timeZone: updateSalonSchema.shape.timeZone,
  capacity: updateSalonSchema.shape.capacity,
  logoUrl: updateSalonSchema.shape.logoUrl,
  customDomain: updateSalonSchema.shape.customDomain,
  businessHours: z
    .array(onboardingBusinessHourSchema)
    .length(7, "Business hours must include all days of the week"),
  
  // Stripe Connect configuration (optional during onboarding)
  depositType: stripeConnectConfigSchema.shape.depositType.default("PERCENTAGE"),
  depositValue: stripeConnectConfigSchema.shape.depositValue.default(2000),
  depositDescription: stripeConnectConfigSchema.shape.depositDescription.default("Booking deposit"),
  requireDeposit: stripeConnectConfigSchema.shape.requireDeposit.default(true),
}).superRefine((value, ctx) => {
  // Validate business hours (same as original schema)
  const seenDays = new Set<DayOfWeekValue>();

  for (const hours of value.businessHours) {
    if (seenDays.has(hours.dayOfWeek)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate day detected",
        path: ["businessHours"],
      });
      return;
    }

    seenDays.add(hours.dayOfWeek);
  }

  // Validate Stripe configuration if deposits are required
  if (value.requireDeposit) {
    if (value.depositType === "PERCENTAGE") {
      if (value.depositValue && (value.depositValue < 100 || value.depositValue > 10000)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percentage must be between 1% and 100% (100-10000 basis points)",
          path: ["depositValue"],
        });
      }
    } else if (value.depositType === "FIXED_AMOUNT") {
      if (value.depositValue && value.depositValue < 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed amount must be at least $1.00 (100 cents)",
          path: ["depositValue"],
        });
      }
    }
  }
});

export type OwnerOnboardingInput = z.infer<typeof ownerOnboardingSchema>;
export type OwnerOnboardingWithStripeInput = z.infer<typeof ownerOnboardingWithStripeSchema>;
