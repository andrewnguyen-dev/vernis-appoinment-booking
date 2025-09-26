"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SalonSettingsForm, type SalonSettingsFormResult } from "@/components/salon/salon-settings-form";
import { StripeConnectSetup } from "@/components/stripe/stripe-connect-setup";
import type { OwnerOnboardingInput, OwnerOnboardingWithStripeInput } from "@/helpers/zod/onboarding-schemas";
import type { StripeConnectConfigData } from "@/helpers/zod/stripe-schemas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp } from "lucide-react";

interface OnboardingWithStripeFormResult extends SalonSettingsFormResult {
  fieldErrors?: Partial<Record<keyof OwnerOnboardingWithStripeInput, string | undefined>>;
}

interface OnboardingWithStripeFormProps {
  initialValues: OwnerOnboardingInput;
  stripeAccountId?: string | null;
  ownerName?: string | null;
  onSubmit: (values: OwnerOnboardingWithStripeInput) => Promise<OnboardingWithStripeFormResult>;
}

export function OnboardingWithStripeForm({
  initialValues,
  stripeAccountId,
  ownerName,
  onSubmit,
}: OnboardingWithStripeFormProps) {
  const router = useRouter();
  const [showStripeConfig, setShowStripeConfig] = useState(false);
  const [stripeConfig, setStripeConfig] = useState<StripeConnectConfigData>({
    depositType: "PERCENTAGE",
    depositValue: 2000, // 20%
    depositDescription: "Booking deposit",
    requireDeposit: true,
  });

  // Convert basic onboarding data to extended format
  async function handleSubmit(basicValues: OwnerOnboardingInput): Promise<SalonSettingsFormResult> {
    const fullValues: OwnerOnboardingWithStripeInput = {
      ...basicValues,
      ...stripeConfig,
    };

    const result = await onSubmit(fullValues);

    // Convert the extended field errors back to basic format for the salon settings form
    if (result.fieldErrors) {
      const basicFieldErrors: Partial<Record<keyof OwnerOnboardingInput, string | undefined>> = {
        name: result.fieldErrors.name,
        slug: result.fieldErrors.slug,
        timeZone: result.fieldErrors.timeZone,
        capacity: result.fieldErrors.capacity,
        logoUrl: result.fieldErrors.logoUrl,
        customDomain: result.fieldErrors.customDomain,
        businessHours: result.fieldErrors.businessHours,
      };

      return {
        ...result,
        fieldErrors: basicFieldErrors,
      };
    }

    return result;
  }

  return (
    <div className="space-y-6">
      {/* Basic Salon Settings */}
      <SalonSettingsForm
        initialValues={initialValues}
        ownerName={ownerName}
        onSubmit={handleSubmit}
        onSuccess={() => router.push("/onboarding/success")}
        copyOverrides={{
          footerNote: showStripeConfig 
            ? "Configure payment settings below, then continue to complete setup."
            : "You can set up payments after completing onboarding.",
          submitLabel: "Complete Setup",
          submittingLabel: "Setting up...",
          successToast: "Salon setup completed successfully!",
        }}
      />

      <Separator />

      {/* Optional Stripe Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Payment Setup (Optional)</CardTitle>
              <CardDescription>
                Set up Stripe to accept payments during onboarding, or configure this later.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStripeConfig(!showStripeConfig)}
              className="flex items-center gap-2"
            >
              {showStripeConfig ? (
                <>
                  Hide Setup
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Set Up Now
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        
        {showStripeConfig && (
          <CardContent>
            <StripeConnectSetup
              initialValues={stripeConfig}
              stripeAccountId={stripeAccountId}
              onConfigUpdate={setStripeConfig}
              showInOnboarding={true}
            />
          </CardContent>
        )}
      </Card>

      {!showStripeConfig && (
        <div className="text-center text-sm text-muted-foreground">
          <p>Don&apos;t worry - you can always set up payments later in your Settings.</p>
        </div>
      )}
    </div>
  );
}