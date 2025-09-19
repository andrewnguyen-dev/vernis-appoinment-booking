"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Save, Globe, Clock, Building, Image as ImageIcon, Hash } from "lucide-react";
import { updateSalonSchema, type UpdateSalonData } from "@/helpers/zod/salon-schemas";
import { updateSalonSettings } from "@/app/actions/salon-settings";
import { getAvailableTimeZones } from "@/lib/timezone";

interface SalonData {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
  logoUrl: string | null;
  capacity: number | null;
  customDomain: string | null;
}

interface SalonGeneralSettingsProps {
  salon: SalonData;
  onUpdate: (data: SalonData) => void;
}

export function SalonGeneralSettings({ salon, onUpdate }: SalonGeneralSettingsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpdateSalonData>({
    resolver: zodResolver(updateSalonSchema),
    defaultValues: {
      name: salon.name,
      slug: salon.slug,
      timeZone: salon.timeZone,
      logoUrl: salon.logoUrl || "",
      capacity: salon.capacity || undefined,
      customDomain: salon.customDomain || "",
    },
  });

  const timeZones = getAvailableTimeZones();

  async function onSubmit(data: UpdateSalonData) {
    try {
      setIsSubmitting(true);
      setError(null);

      const result = await updateSalonSettings(data);

      if (result.success && result.data) {
        onUpdate({
          id: result.data.id,
          name: result.data.name,
          slug: result.data.slug,
          timeZone: result.data.timeZone,
          logoUrl: result.data.logoUrl,
          capacity: result.data.capacity,
          customDomain: result.data.customDomain,
        });
      } else {
        setError(result.error || "Failed to update salon settings");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error updating salon:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Salon Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Salon Name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Salon" {...field} />
                    </FormControl>
                    <FormDescription>
                      The public name of your salon
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Salon Slug */}
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
                      <Input placeholder="my-awesome-salon" {...field} />
                    </FormControl>
                    <FormDescription>
                      Your booking URL: vernis.com/{field.value || "your-salon"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time Zone */}
              <FormField
                control={form.control}
                name="timeZone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Time Zone
                    </FormLabel>
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
                    <FormDescription>
                      All appointment times will be displayed in this time zone
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Capacity */}
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salon Capacity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="5" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of concurrent appointments
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Logo URL */}
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4"/>
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

            {/* Custom Domain */}
            <FormField
              control={form.control}
              name="customDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Custom Domain
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="booking.mysalon.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Use your own domain for booking (please send us an email to set this up)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}