"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateStaffProfileAction, removeStaffFromSalonAction } from "@/app/actions/staff-management";

const staffSettingsSchema = z.object({
  phone: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  active: z.boolean(),
  notes: z.string().optional(),
});

type StaffSettingsData = z.infer<typeof staffSettingsSchema>;

interface Staff {
  id: string;
  phone: string | null;
  color: string;
  active: boolean;
  notes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  isOwner?: boolean;
}

interface StaffSettingsDialogProps {
  staff: Staff | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

const colorOptions = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#EC4899", // Pink
  "#6366F1", // Indigo
];

export function StaffSettingsDialog({
  staff,
  isOpen,
  onOpenChange,
  onClose,
}: StaffSettingsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const router = useRouter();

  const form = useForm<StaffSettingsData>({
    resolver: zodResolver(staffSettingsSchema),
    values: staff
      ? {
          phone: staff.phone || "",
          color: staff.color,
          active: staff.active,
          notes: staff.notes || "",
        }
      : undefined,
  });

  async function onSubmit(data: StaffSettingsData) {
    if (!staff) return;

    try {
      setIsLoading(true);

      const result = await updateStaffProfileAction(staff.id, {
        phone: data.phone || undefined,
        color: data.color,
        active: data.active,
        notes: data.notes || undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      router.refresh();
      onClose();
    } catch (error) {
      console.error("Failed to update staff:", error);
      // TODO: Add proper error handling/toast
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemoveStaff() {
    if (!staff) return;

    try {
      setIsLoading(true);

      const result = await removeStaffFromSalonAction(staff.user.id, staff.id);

      if (result.error) {
        throw new Error(result.error);
      }

      router.refresh();
      onClose();
    } catch (error) {
      console.error("Failed to remove staff:", error);
      // TODO: Add proper error handling/toast
    } finally {
      setIsLoading(false);
    }
  }

  if (!staff) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Staff Settings</DialogTitle>
          <DialogDescription>
            Update {staff.user.name}&apos;s profile and settings.
            {staff.isOwner && (
              <span className="block text-sm font-medium text-blue-600 mt-1">
                This user is the salon owner.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!showRemoveConfirm ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Display user info (read-only) */}
              <div className="space-y-2 p-3 bg-gray-50 rounded-md">
                <div className="text-sm">
                  <span className="font-medium">Name:</span> {staff.user.name}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Email:</span> {staff.user.email}
                </div>
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="grid grid-cols-5 gap-2">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`w-8 h-8 rounded-full border-2 ${
                                field.value === color
                                  ? "border-gray-900"
                                  : "border-gray-200"
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => field.onChange(color)}
                            />
                          ))}
                        </div>
                        <Input
                          type="color"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-full h-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Staff member can be assigned to appointments
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between">
                {!staff.isOwner && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowRemoveConfirm(true)}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
                <div className="space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold">Remove Staff Member</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Are you sure you want to remove {staff.user.name} from your salon?
                {staff.isOwner && (
                  <span className="block text-red-600 font-medium mt-1">
                    Warning: This user is the salon owner and cannot be removed.
                  </span>
                )}
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveStaff}
                disabled={isLoading}
              >
                {isLoading ? "Removing..." : "Remove Staff"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
