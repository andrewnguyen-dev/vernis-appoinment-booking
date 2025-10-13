"use client";

import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  ownerOnboardingSchema,
  dayOfWeekValues,
  type OwnerOnboardingInput,
  type DayOfWeekValue,
} from "@/helpers/zod/onboarding-schemas";
import { getAvailableTimeZones } from "@/lib/timezone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CalendarClock,
  Building,
  Users,
  Image as ImageIcon,
  Globe,
  Hash,
} from "lucide-react";

interface SalonSettingsFormResult {
  success: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<keyof OwnerOnboardingInput, string | undefined>>;
  data?: unknown;
}

interface CopyOverrides {
  description?: string;
  footerNote?: string;
  submitLabel?: string;
  submittingLabel?: string;
  successToast?: string;
}

interface SalonSettingsFormProps {
  initialValues: OwnerOnboardingInput;
  ownerName?: string | null;
  onSubmit: (values: OwnerOnboardingInput) => Promise<SalonSettingsFormResult>;
  onSuccess?: (result: SalonSettingsFormResult) => void;
  showBrandingFields?: boolean;
  copyOverrides?: CopyOverrides;
}

const dayLabels: Record<DayOfWeekValue, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const dayHints: Partial<Record<DayOfWeekValue, string>> = {
  SATURDAY: "Weekend walk-ins? Adjust your shorter hours here.",
  SUNDAY: "Mark as closed if you take Sundays off.",
};

export function SalonSettingsForm({
  initialValues,
  ownerName,
  onSubmit,
  onSuccess,
  showBrandingFields = false,
  copyOverrides,
}: SalonSettingsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeZones = getAvailableTimeZones();

  const form = useForm<OwnerOnboardingInput>({
    resolver: zodResolver(ownerOnboardingSchema),
    defaultValues: initialValues,
    mode: "onSubmit",
  });

  const businessHours = form.watch("businessHours");

  const {
    description = `Hey ${ownerName ?? "there"}, let's confirm the essentials for your salon profile.`,
    footerNote = "You can update these details anytime from Settings.",
    submitLabel = "Continue",
    submittingLabel = "Saving...",
    successToast,
  } = copyOverrides ?? {};

  async function handleSubmit(values: OwnerOnboardingInput) {
    try {
      setIsSubmitting(true);

      const result = await onSubmit(values);

      if (!result.success) {
        if (result.fieldErrors) {
          (Object.entries(result.fieldErrors) as Array<[FieldPath<OwnerOnboardingInput>, string | undefined]>).forEach(([field, message]) => {
            if (!message) {
              return;
            }

            form.setError(field, {
              type: "server",
              message,
            });
          });
        }

        if (result.error) {
          toast.error(result.error);
        }

        setIsSubmitting(false);
        return;
      }

      if (successToast ?? result.message) {
        toast.success(successToast ?? result.message ?? "Settings saved");
      }

      onSuccess?.(result);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Failed to submit salon settings:", error);
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Salon basics
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Salon name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Sarah's Beauty Studio" {...field} />
                    </FormControl>
                    <FormDescription>This appears wherever clients see your salon.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Salon URL
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="sarahs-beauty-studio" {...field} />
                    </FormControl>
                    <FormDescription>Your booking link will be vernis.app/{field.value || "your-salon"}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeZone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time zone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a time zone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeZones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>We use this for appointment reminders and availability.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Concurrent appointments
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="1"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription>How many clients can you serve at the same time?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showBrandingFields && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Logo URL
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/logo.png" {...field} />
                      </FormControl>
                      <FormDescription>
                        A direct URL to your salon&apos;s logo image (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customDomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Custom domain
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="booking.mysalon.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Use your own domain for booking (contact us to finish setup)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Business hours
            </CardTitle>
            <CardDescription>Set when clients can book appointments each day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dayOfWeekValues.map((day, index) => {
              const hours = businessHours?.[index];
              const isClosed = hours?.isClosed ?? false;

              return (
                <div key={day} className="rounded-lg border p-4">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{dayLabels[day]}</p>
                      <p className="text-sm text-muted-foreground">
                        {dayHints[day] ?? "Choose the window when clients can book."}
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name={`businessHours.${index}.isClosed` as FieldPath<OwnerOnboardingInput>}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormLabel className="text-sm font-medium">Open</FormLabel>
                          <FormControl>
                            <Switch
                              checked={!field.value}
                              onCheckedChange={(checked) => field.onChange(!checked)}
                              aria-label={`Toggle whether ${dayLabels[day]} is open`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`businessHours.${index}.openTime` as FieldPath<OwnerOnboardingInput>}
                      render={({ field }) => {
                        const value = typeof field.value === "string" ? field.value : "";

                        return (
                          <FormItem>
                            <FormLabel>Opens at</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                step={300}
                                disabled={isClosed}
                                value={value}
                                onChange={(event) => field.onChange(event.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name={`businessHours.${index}.closeTime` as FieldPath<OwnerOnboardingInput>}
                      render={({ field }) => {
                        const value = typeof field.value === "string" ? field.value : "";

                        return (
                          <FormItem>
                            <FormLabel>Closes at</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                step={300}
                                disabled={isClosed}
                                value={value}
                                onChange={(event) => field.onChange(event.target.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  {isClosed && (
                    <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                      We&apos;ll mark {dayLabels[day]} as closed.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{footerNote}</p>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {submittingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export type { SalonSettingsFormResult };
