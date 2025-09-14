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
import { createCategorySchema, updateCategorySchema, type CreateCategoryData, type UpdateCategoryData } from "@/helpers/zod/catalog-schemas";
import { createCategory, updateCategory } from "@/app/actions/catalog";
import toast from "react-hot-toast";

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: {
    id: string;
    name: string;
    order: number;
  };
  onSuccess?: () => void;
}

export function CategoryForm({ open, onOpenChange, category, onSuccess }: CategoryFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!category;

  const form = useForm({
    resolver: zodResolver(isEditing ? updateCategorySchema : createCategorySchema),
    defaultValues: {
      name: "",
      order: 0,
      ...(isEditing && { id: "" }),
    },
  });

  // Reset form when category prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (isEditing && category) {
        form.reset({
          name: category.name,
          order: category.order,
          ...(isEditing && { id: category.id }),
        });
      } else {
        form.reset({
          name: "",
          order: 0,
        });
      }
    }
  }, [open, isEditing, category, form]);

  const onSubmit = async (data: CreateCategoryData | UpdateCategoryData) => {
    setIsLoading(true);
    
    try {
      const result = isEditing 
        ? await updateCategory(data as UpdateCategoryData)
        : await createCategory(data as CreateCategoryData);

      if (result.success) {
        toast.success(isEditing ? "Category updated successfully" : "Category created successfully");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Category" : "Create Category"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the category details below." 
              : "Add a new service category to organize your services."
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Hair Services" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
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
