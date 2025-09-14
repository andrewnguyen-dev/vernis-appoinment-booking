import { z } from "zod";

// Service Category Schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Category name must be less than 100 characters"),
  order: z.number().int().min(0),
});

export const updateCategorySchema = z.object({
  id: z.string().min(1, "Category ID is required"),
  name: z.string().min(1, "Category name is required").max(100, "Category name must be less than 100 characters"),
  order: z.number().int().min(0),
});

export const deleteCategorySchema = z.object({
  id: z.string().min(1, "Category ID is required"),
});

// Service Schemas
export const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(200, "Service name must be less than 200 characters"),
  categoryId: z.string().optional(),
  durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute").max(480, "Duration cannot exceed 8 hours"),
  priceCents: z.number().int().min(0, "Price must be non-negative"),
  active: z.boolean().default(true),
});

export const updateServiceSchema = z.object({
  id: z.string().min(1, "Service ID is required"),
  name: z.string().min(1, "Service name is required").max(200, "Service name must be less than 200 characters"),
  categoryId: z.string().optional(),
  durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute").max(480, "Duration cannot exceed 8 hours"),
  priceCents: z.number().int().min(0, "Price must be non-negative"),
  active: z.boolean(),
});

export const deleteServiceSchema = z.object({
  id: z.string().min(1, "Service ID is required"),
});

export const reorderCategoriesSchema = z.object({
  categoryOrders: z.array(z.object({
    id: z.string(),
    order: z.number().int().min(0),
  })),
});

export type CreateCategoryData = z.infer<typeof createCategorySchema>;
export type UpdateCategoryData = z.infer<typeof updateCategorySchema>;
export type DeleteCategoryData = z.infer<typeof deleteCategorySchema>;
export type CreateServiceData = z.infer<typeof createServiceSchema>;
export type UpdateServiceData = z.infer<typeof updateServiceSchema>;
export type DeleteServiceData = z.infer<typeof deleteServiceSchema>;
export type ReorderCategoriesData = z.infer<typeof reorderCategoriesSchema>;
