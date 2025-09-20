import prisma from "@/db";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getOwnerSalonOrThrow } from "@/lib/user-utils";
import { buildSalonSettingsInitialValues } from "@/lib/salon-settings";
import { SalonSettingsForm } from "@/components/salon/salon-settings-form";
import { updateSalonSettings } from "@/app/actions/salon-settings";
import { type DayOfWeekValue } from "@/helpers/zod/onboarding-schemas";

export default async function SettingsPage() {
  const session = await requireOwnerAuth();
  const salon = await getOwnerSalonOrThrow(session.user.id);
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
    <div className="container mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Salon Settings</h1>
        <p className="text-muted-foreground">
          Keep your booking details and business hours up to date for clients.
        </p>
      </div>

      <SalonSettingsForm
        initialValues={initialValues}
        ownerName={session.user.name}
        onSubmit={updateSalonSettings}
        showBrandingFields
        copyOverrides={{
          description: "Review your public details and availability before clients book.",
          footerNote: "Updates apply immediately to your booking experience.",
          submitLabel: "Save changes",
          submittingLabel: "Saving...",
          successToast: "Salon settings updated successfully!",
        }}
      />
    </div>
  );
}
