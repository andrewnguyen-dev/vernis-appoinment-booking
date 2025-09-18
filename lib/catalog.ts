import prisma from "@/db";
import { getOwnerSalonOrThrow } from "@/lib/user-utils";

export async function getOwnerCatalog(userId: string) {
  const salon = await getOwnerSalonOrThrow(userId);

  const [categories, uncategorizedServices] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { salonId: salon.id },
      include: {
        services: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { order: "asc" },
    }),
    prisma.service.findMany({
      where: {
        salonId: salon.id,
        categoryId: null,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    salon,
    categories,
    uncategorizedServices,
  };
}
