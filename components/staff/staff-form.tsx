"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addStaffToSalonAction } from "@/app/actions/staff-management";

const staffFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type StaffFormData = z.infer<typeof staffFormSchema>;

interface StaffFormProps {
  salonId: string;
  onSuccess?: () => void;
}

export function StaffForm({ salonId, onSuccess }: StaffFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      email: "",
      phone: "",
      notes: "",
    },
  });

  async function onSubmit(data: StaffFormData) {
    try {
      setIsLoading(true);
      
      const result = await addStaffToSalonAction(salonId, {
        email: data.email,
        phone: data.phone || undefined,
        notes: data.notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Staff member added successfully!");
      form.reset();
      router.refresh();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add staff:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Enter staff member's email"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The staff member must have an existing account with this email.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="Enter phone number"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional notes about this staff member"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional notes about the staff member&apos;s role, schedule, etc.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSuccess?.()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Staff"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
