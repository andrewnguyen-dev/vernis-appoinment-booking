"use server";

import { z } from "zod";
import prisma from "@/db";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getOwnerCatalog } from "@/lib/catalog";
import { getOwnerSalonOrThrow } from "@/lib/user-utils";
import { revalidatePath } from "next/cache";
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  createServiceSchema,
  updateServiceSchema,
  deleteServiceSchema,
  reorderCategoriesSchema,
  type CreateCategoryData,
  type UpdateCategoryData,
  type DeleteCategoryData,
  type CreateServiceData,
  type UpdateServiceData,
  type DeleteServiceData,
  type ReorderCategoriesData,
} from "@/helpers/zod/catalog-schemas";

// Category Actions
export async function createCategory(data: CreateCategoryData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = createCategorySchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Check if category with this name already exists
    const existingCategory = await prisma.serviceCategory.findUnique({
      where: {
        salonId_name: {
          salonId: salon.id,
          name: validatedData.name,
        },
      },
    });

    if (existingCategory) {
      return {
        success: false,
        error: "A category with this name already exists",
      };
    }

    const category = await prisma.serviceCategory.create({
      data: {
        salonId: salon.id,
        name: validatedData.name,
        order: validatedData.order,
      },
    });

    revalidatePath("/catalog");
    
    return {
      success: true,
      data: category,
    };
  } catch (error) {
    console.error("Error creating category:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to create category. Please try again.",
    };
  }
}

export async function updateCategory(data: UpdateCategoryData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = updateCategorySchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Verify category belongs to user's salon
    const existingCategory = await prisma.serviceCategory.findFirst({
      where: {
        id: validatedData.id,
        salonId: salon.id,
      },
    });

    if (!existingCategory) {
      return {
        success: false,
        error: "Category not found",
      };
    }

    // Check if another category with this name already exists
    const duplicateCategory = await prisma.serviceCategory.findFirst({
      where: {
        salonId: salon.id,
        name: validatedData.name,
        id: { not: validatedData.id },
      },
    });

    if (duplicateCategory) {
      return {
        success: false,
        error: "A category with this name already exists",
      };
    }

    const category = await prisma.serviceCategory.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        order: validatedData.order,
      },
    });

    revalidatePath("/catalog");
    
    return {
      success: true,
      data: category,
    };
  } catch (error) {
    console.error("Error updating category:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to update category. Please try again.",
    };
  }
}

export async function deleteCategory(data: DeleteCategoryData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = deleteCategorySchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Verify category belongs to user's salon
    const existingCategory = await prisma.serviceCategory.findFirst({
      where: {
        id: validatedData.id,
        salonId: salon.id,
      },
      include: {
        services: true,
      },
    });

    if (!existingCategory) {
      return {
        success: false,
        error: "Category not found",
      };
    }

    // Check if category has services
    if (existingCategory.services.length > 0) {
      return {
        success: false,
        error: "Cannot delete category that contains services. Please move or delete services first.",
      };
    }

    await prisma.serviceCategory.delete({
      where: { id: validatedData.id },
    });

    revalidatePath("/catalog");
    
    return {
      success: true,
      data: { id: validatedData.id },
    };
  } catch (error) {
    console.error("Error deleting category:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to delete category. Please try again.",
    };
  }
}

// Service Actions
export async function createService(data: CreateServiceData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = createServiceSchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Check if service with this name already exists
    const existingService = await prisma.service.findUnique({
      where: {
        salonId_name: {
          salonId: salon.id,
          name: validatedData.name,
        },
      },
    });

    if (existingService) {
      return {
        success: false,
        error: "A service with this name already exists",
      };
    }

    // If categoryId is provided, verify it belongs to the salon
    if (validatedData.categoryId) {
      const category = await prisma.serviceCategory.findFirst({
        where: {
          id: validatedData.categoryId,
          salonId: salon.id,
        },
      });

      if (!category) {
        return {
          success: false,
          error: "Invalid category selected",
        };
      }
    }

    const service = await prisma.service.create({
      data: {
        salonId: salon.id,
        name: validatedData.name,
        categoryId: validatedData.categoryId || null,
        durationMinutes: validatedData.durationMinutes,
        priceCents: validatedData.priceCents,
        active: validatedData.active,
      },
      include: {
        category: true,
      },
    });

    revalidatePath("/catalog");
    
    return {
      success: true,
      data: service,
    };
  } catch (error) {
    console.error("Error creating service:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to create service. Please try again.",
    };
  }
}

export async function updateService(data: UpdateServiceData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = updateServiceSchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Verify service belongs to user's salon
    const existingService = await prisma.service.findFirst({
      where: {
        id: validatedData.id,
        salonId: salon.id,
      },
    });

    if (!existingService) {
      return {
        success: false,
        error: "Service not found",
      };
    }

    // Check if another service with this name already exists
    const duplicateService = await prisma.service.findFirst({
      where: {
        salonId: salon.id,
        name: validatedData.name,
        id: { not: validatedData.id },
      },
    });

    if (duplicateService) {
      return {
        success: false,
        error: "A service with this name already exists",
      };
    }

    // If categoryId is provided, verify it belongs to the salon
    if (validatedData.categoryId) {
      const category = await prisma.serviceCategory.findFirst({
        where: {
          id: validatedData.categoryId,
          salonId: salon.id,
        },
      });

      if (!category) {
        return {
          success: false,
          error: "Invalid category selected",
        };
      }
    }

    const service = await prisma.service.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        categoryId: validatedData.categoryId || null,
        durationMinutes: validatedData.durationMinutes,
        priceCents: validatedData.priceCents,
        active: validatedData.active,
      },
      include: {
        category: true,
      },
    });

    revalidatePath("/catalog");
    
    return {
      success: true,
      data: service,
    };
  } catch (error) {
    console.error("Error updating service:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to update service. Please try again.",
    };
  }
}

export async function deleteService(data: DeleteServiceData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = deleteServiceSchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Verify service belongs to user's salon
    const existingService = await prisma.service.findFirst({
      where: {
        id: validatedData.id,
        salonId: salon.id,
      },
    });

    if (!existingService) {
      return {
        success: false,
        error: "Service not found",
      };
    }

    // Check if service has appointments
    const appointmentCount = await prisma.appointmentItem.count({
      where: {
        serviceId: validatedData.id,
      },
    });

    if (appointmentCount > 0) {
      return {
        success: false,
        error: "Cannot delete service that has existing appointments. Consider deactivating it instead.",
      };
    }

    await prisma.service.delete({
      where: { id: validatedData.id },
    });

    revalidatePath("/catalog");
    
    return {
      success: true,
      data: { id: validatedData.id },
    };
  } catch (error) {
    console.error("Error deleting service:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to delete service. Please try again.",
    };
  }
}

export async function reorderCategories(data: ReorderCategoriesData) {
  try {
    const session = await requireOwnerAuth();
    const validatedData = reorderCategoriesSchema.parse(data);
    const salon = await getOwnerSalonOrThrow(session.user.id);

    // Verify all categories belong to user's salon
    const categoryIds = validatedData.categoryOrders.map(c => c.id);
    const categories = await prisma.serviceCategory.findMany({
      where: {
        id: { in: categoryIds },
        salonId: salon.id,
      },
    });

    if (categories.length !== categoryIds.length) {
      return {
        success: false,
        error: "One or more categories not found",
      };
    }

    // Update categories in transaction
    await prisma.$transaction(
      validatedData.categoryOrders.map(({ id, order }) =>
        prisma.serviceCategory.update({
          where: { id },
          data: { order },
        })
      )
    );

    revalidatePath("/catalog");
    
    return {
      success: true,
      data: validatedData.categoryOrders,
    };
  } catch (error) {
    console.error("Error reordering categories:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to reorder categories. Please try again.",
    };
  }
}

// Get catalog data
export async function getCatalogData() {
  try {
    const session = await requireOwnerAuth();
    const { categories, uncategorizedServices } = await getOwnerCatalog(session.user.id);

    return {
      success: true,
      data: {
        categories,
        uncategorizedServices,
      },
    };
  } catch (error) {
    console.error("Error fetching catalog data:", error);
    
    return {
      success: false,
      error: "Failed to load catalog data. Please try again.",
    };
  }
}
