import prisma from "@/db";
import { OwnerOnboardingForm } from "@/components/onboarding/owner-onboarding-form";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import { type DayOfWeekValue } from "@/helpers/zod/onboarding-schemas";
import { buildSalonSettingsInitialValues } from "@/lib/salon-settings";
import { redirect } from "next/navigation";

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

  const initialValues = buildSalonSettingsInitialValues(
    {
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      timeZone: salon.timeZone,
      capacity: salon.capacity,
      logoUrl: salon.logoUrl,
      customDomain: salon.customDomain,
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
