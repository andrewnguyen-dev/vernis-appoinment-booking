import { z } from "zod";
import { updateSalonSchema } from "@/helpers/zod/salon-schemas";

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

export type OwnerOnboardingInput = z.infer<typeof ownerOnboardingSchema>;
