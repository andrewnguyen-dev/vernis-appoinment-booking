"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createServiceSchema, updateServiceSchema, type CreateServiceData, type UpdateServiceData } from "@/helpers/zod/catalog-schemas";
import { createService, updateService } from "@/app/actions/catalog";
import toast from "react-hot-toast";

interface ServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: {
    id: string;
    name: string;
    categoryId: string | null;
    durationMinutes: number;
    priceCents: number;
    active: boolean;
  };
  categories: Array<{
    id: string;
    name: string;
  }>;
  onSuccess?: () => void;
}

export function ServiceForm({ open, onOpenChange, service, categories, onSuccess }: ServiceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!service;

  const form = useForm({
    resolver: zodResolver(isEditing ? updateServiceSchema : createServiceSchema),
    defaultValues: {
      name: "",
      categoryId: "none",
      durationMinutes: 30,
      priceCents: 0,
      active: true,
      ...(isEditing && { id: "" }),
    },
  });

  // Reset form when service prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (isEditing && service) {
        form.reset({
          name: service.name,
          categoryId: service.categoryId || "none",
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
          active: service.active,
          ...(isEditing && { id: service.id }),
        });
      } else {
        form.reset({
          name: "",
          categoryId: "none",
          durationMinutes: 30,
          priceCents: 0,
          active: true,
        });
      }
    }
  }, [open, isEditing, service, form]);

  const onSubmit = async (data: CreateServiceData | UpdateServiceData) => {
    setIsLoading(true);
    
    try {
      // Convert "none" back to undefined for optional categoryId
      const submitData = {
        ...data,
        categoryId: data.categoryId === "none" ? undefined : data.categoryId,
      };

      const result = isEditing 
        ? await updateService(submitData as UpdateServiceData)
        : await createService(submitData as CreateServiceData);

      if (result.success) {
        toast.success(isEditing ? "Service updated successfully" : "Service created successfully");
        form.reset();
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "An error occurred");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPriceForDisplay = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const formatPriceForStorage = (dollars: string) => {
    return Math.round(parseFloat(dollars || "0") * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Service" : "Create Service"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the service details below." 
              : "Add a new service to your catalog."
            }
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Haircut & Style" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select 
                    value={field.value || "none"} 
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="30" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priceCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={formatPriceForDisplay(field.value)}
                        onChange={(e) => field.onChange(formatPriceForStorage(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Service</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Make this service available for booking
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
