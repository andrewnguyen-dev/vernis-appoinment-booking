"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  ownerOnboardingSchema,
  type OwnerOnboardingInput,
  dayOfWeekValues,
  type DayOfWeekValue,
} from "@/helpers/zod/onboarding-schemas";
import { completeOwnerOnboarding } from "@/app/actions/owner-onboarding";
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
} from "lucide-react";

interface OwnerOnboardingFormProps {
  initialValues: OwnerOnboardingInput;
  ownerName?: string | null;
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

export function OwnerOnboardingForm({ initialValues, ownerName }: OwnerOnboardingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeZones = getAvailableTimeZones();

  const form = useForm<OwnerOnboardingInput>({
    resolver: zodResolver(ownerOnboardingSchema),
    defaultValues: initialValues,
    mode: "onSubmit",
  });

  const businessHours = form.watch("businessHours");

  async function onSubmit(values: OwnerOnboardingInput) {
    try {
      setIsSubmitting(true);

      const result = await completeOwnerOnboarding(values);

      if (!result.success) {
        if (result.fieldErrors) {
          (Object.entries(result.fieldErrors) as Array<[keyof OwnerOnboardingInput, string | undefined]>).forEach(([field, message]) => {
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

      toast.success("Onboarding completed! Let's set up the rest.");
      router.push("/onboarding/success");
    } catch (error) {
      console.error("Failed to submit onboarding:", error);
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Salon basics
            </CardTitle>
            <CardDescription>
              Hey {ownerName ?? "there"}, let&apos;s confirm the essentials for your salon profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salon name</FormLabel>
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
                    <FormLabel>Salon URL</FormLabel>
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
          <p className="text-sm text-muted-foreground">
            You can update these details anytime from Settings.
          </p>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
