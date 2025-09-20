import { dayOfWeekValues, type DayOfWeekValue, type OwnerOnboardingInput } from "@/helpers/zod/onboarding-schemas";

interface SalonBasics {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
  capacity: number | null;
  logoUrl: string | null;
  customDomain: string | null;
}

interface ExistingBusinessHours {
  dayOfWeek: DayOfWeekValue;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const defaultHours: Record<DayOfWeekValue, { openTime: string; closeTime: string; isClosed: boolean }> = {
  MONDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  TUESDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  WEDNESDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  THURSDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  FRIDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  SATURDAY: { openTime: "09:00", closeTime: "15:00", isClosed: false },
  SUNDAY: { openTime: "10:00", closeTime: "16:00", isClosed: true },
};

export function buildSalonSettingsInitialValues(
  salon: SalonBasics,
  existingHours: ExistingBusinessHours[],
): OwnerOnboardingInput {
  const hoursMap = new Map(existingHours.map((hours) => [hours.dayOfWeek, hours]));

  return {
    name: salon.name,
    slug: salon.slug,
    timeZone: salon.timeZone,
    capacity: salon.capacity ?? 1,
    logoUrl: salon.logoUrl ?? "",
    customDomain: salon.customDomain ?? "",
    businessHours: dayOfWeekValues.map((day) => {
      const saved = hoursMap.get(day);
      const fallback = defaultHours[day];

      return {
        dayOfWeek: day,
        isClosed: saved?.isClosed ?? fallback.isClosed,
        openTime: saved?.openTime ?? fallback.openTime,
        closeTime: saved?.closeTime ?? fallback.closeTime,
      };
    }),
  };
}

export const fallbackBusinessHours = defaultHours;
