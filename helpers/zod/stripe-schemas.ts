import { z } from "zod";

// Stripe Connect Configuration Schema
export const stripeConnectConfigSchema = z.object({
  depositType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "AUTHORIZATION_ONLY"]),
  depositValue: z.number()
    .int("Deposit value must be a whole number")
    .min(0, "Deposit value cannot be negative"),
  depositDescription: z.string()
    .min(1, "Deposit description is required")
    .max(200, "Deposit description must be less than 200 characters")
    .trim(),
  requireDeposit: z.boolean(),
}).superRefine((data, ctx) => {
  if (!data.requireDeposit) {
    return; // Skip validation if deposits are not required
  }

  if (data.depositType === "PERCENTAGE") {
    if (data.depositValue < 100 || data.depositValue > 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage must be between 1% and 100% (100-10000 basis points)",
        path: ["depositValue"],
      });
    }
  } else if (data.depositType === "FIXED_AMOUNT") {
    if (data.depositValue < 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed amount must be at least $1.00 (100 cents)",
        path: ["depositValue"],
      });
    }
  } else if (data.depositType === "AUTHORIZATION_ONLY") {
    // For authorization only, we always use 100 cents ($1.00)
    // but we don't need to validate the value here since it's set automatically
  }
});

// Extended salon schema that includes Stripe configuration
export const salonWithStripeSchema = z.object({
  // Basic salon fields (from existing schema)
  name: z.string()
    .min(1, "Salon name is required")
    .max(100, "Salon name must be less than 100 characters")
    .trim(),
  
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .trim(),
  
  timeZone: z.string()
    .min(1, "Time zone is required"),
  
  logoUrl: z.string()
    .url("Logo URL must be a valid URL")
    .optional()
    .or(z.literal("")),
  
  capacity: z.number()
    .int("Capacity must be a whole number")
    .min(1, "Salon capacity is required")
    .max(100, "Capacity cannot exceed 100"),
  
  customDomain: z.string()
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid domain format")
    .optional()
    .or(z.literal("")),

  // Stripe Connect configuration
  depositType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "AUTHORIZATION_ONLY"]),
  depositValue: z.number()
    .int("Deposit value must be a whole number")
    .min(0, "Deposit value cannot be negative"),
  depositDescription: z.string()
    .min(1, "Deposit description is required")
    .max(200, "Deposit description must be less than 200 characters")
    .trim(),
  requireDeposit: z.boolean(),
}).superRefine((data, ctx) => {
  if (!data.requireDeposit) {
    return;
  }

  if (data.depositType === "PERCENTAGE") {
    if (data.depositValue < 100 || data.depositValue > 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage must be between 1% and 100% (100-10000 basis points)",
        path: ["depositValue"],
      });
    }
  } else if (data.depositType === "FIXED_AMOUNT") {
    if (data.depositValue < 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed amount must be at least $1.00 (100 cents)",
        path: ["depositValue"],
      });
    }
  }
});

// Type exports
export type StripeConnectConfigData = z.infer<typeof stripeConnectConfigSchema>;
export type SalonWithStripeData = z.infer<typeof salonWithStripeSchema>;