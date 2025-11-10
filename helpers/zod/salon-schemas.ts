import { z } from "zod";

// Salon Settings Schema

export const updateSalonSchema = z.object({
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

  capturePercentage: z.number()
    .int("Capture percentage must be a whole number")
    .min(0, "Capture percentage cannot be less than 0%")
    .max(100, "Capture percentage cannot exceed 100%"),
});

// Type exports
export type UpdateSalonData = z.infer<typeof updateSalonSchema>;
