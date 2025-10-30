// /lib/tenancy.ts
import prisma from "@/db";

export async function getSalonBySlug(slug: string) {
  return prisma.salon.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      timeZone: true,
      slug: true,
      logoUrl: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeRequirementsDue: true,
      platformFeePercent: true,
      platformFeeMinCents: true,
    },
  });
}

export async function getCatalogForSalon(salonId: string) {
  // Categories with their services
  return prisma.serviceCategory.findMany({
    where: { salonId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      services: {
        where: { active: true },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          priceCents: true,
        },
      },
    },
  });
}
