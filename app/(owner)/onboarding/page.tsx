import prisma from "@/db";
import { OwnerOnboardingForm } from "@/components/onboarding/owner-onboarding-form";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import {
  dayOfWeekValues,
  type DayOfWeekValue,
  type OwnerOnboardingInput,
} from "@/helpers/zod/onboarding-schemas";
import { redirect } from "next/navigation";

const fallbackBusinessHours: Record<DayOfWeekValue, { openTime: string; closeTime: string; isClosed: boolean }> = {
  MONDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  TUESDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  WEDNESDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  THURSDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  FRIDAY: { openTime: "09:00", closeTime: "17:00", isClosed: false },
  SATURDAY: { openTime: "09:00", closeTime: "15:00", isClosed: false },
  SUNDAY: { openTime: "10:00", closeTime: "16:00", isClosed: true },
};

function buildInitialValues(
  salon: {
    id: string;
    name: string;
    slug: string;
    timeZone: string;
    capacity: number;
  },
  existingHours: Array<{
    dayOfWeek: DayOfWeekValue;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }>,
): OwnerOnboardingInput {
  const hoursMap = new Map(existingHours.map((hours) => [hours.dayOfWeek, hours]));

  return {
    name: salon.name,
    slug: salon.slug,
    timeZone: salon.timeZone,
    capacity: salon.capacity,
    businessHours: dayOfWeekValues.map((day) => {
      const saved = hoursMap.get(day);
      const fallback = fallbackBusinessHours[day];

      return {
        dayOfWeek: day,
        isClosed: saved?.isClosed ?? fallback.isClosed,
        openTime: saved?.openTime ?? fallback.openTime,
        closeTime: saved?.closeTime ?? fallback.closeTime,
      };
    }),
  };
}

export default async function OwnerOnboardingPage() {
  const session = await requireOwnerAuth({ allowIncompleteOnboarding: true });
  const salon = await getUserSalon(session.user.id, "OWNER");

  if (!salon) {
    redirect("/owner-sign-in");
  }

  if (salon.hasCompletedOnboarding) {
    redirect("/dashboard");
  }

  const businessHours = await prisma.businessHours.findMany({
    where: { salonId: salon.id },
  });

  const initialValues = buildInitialValues(
    {
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      timeZone: salon.timeZone,
      capacity: salon.capacity,
    },
    businessHours.map((hours) => ({
      dayOfWeek: hours.dayOfWeek as DayOfWeekValue,
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      isClosed: hours.isClosed,
    })),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Let&apos;s set up your salon</h1>
        <p className="text-muted-foreground">
          We&apos;ll start with the basics so your booking link is ready. You can always tweak these later.
        </p>
      </div>

      <OwnerOnboardingForm initialValues={initialValues} ownerName={session.user.name} />
    </div>
  );
}
