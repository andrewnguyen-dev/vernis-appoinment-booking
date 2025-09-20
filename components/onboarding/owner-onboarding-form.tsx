"use client";

import { useRouter } from "next/navigation";
import { completeOwnerOnboarding } from "@/app/actions/owner-onboarding";
import { SalonSettingsForm } from "@/components/salon/salon-settings-form";
import type { OwnerOnboardingInput } from "@/helpers/zod/onboarding-schemas";

interface OwnerOnboardingFormProps {
  initialValues: OwnerOnboardingInput;
  ownerName?: string | null;
}

export function OwnerOnboardingForm({ initialValues, ownerName }: OwnerOnboardingFormProps) {
  const router = useRouter();

  return (
    <SalonSettingsForm
      initialValues={initialValues}
      ownerName={ownerName}
      onSubmit={completeOwnerOnboarding}
      onSuccess={() => router.push("/onboarding/success")}
      copyOverrides={{
        footerNote: "You can update these details anytime from Settings.",
        submitLabel: "Continue",
        submittingLabel: "Saving...",
        successToast: "Onboarding completed! Let's set up the rest.",
      }}
    />
  );
}
