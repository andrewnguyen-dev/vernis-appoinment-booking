import prisma from "@/db";
import { Role } from "@prisma/client";

// Generate a random color for new staff
export function generateRandomStaffColor(): string {
  const colors = [
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
  return colors[Math.floor(Math.random() * colors.length)];
}

// Get staff profile for a user in a salon
export async function getStaffProfile(userId: string, salonId: string) {
  return prisma.staff.findUnique({
    where: {
      salonId_userId: {
        salonId,
        userId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      salon: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

// Get all staff for a salon
export async function getSalonStaff(salonId: string) {
  return prisma.staff.findMany({
    where: {
      salonId,
      active: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

// Get all staff for a salon with ownership information
export async function getSalonStaffWithOwnership(salonId: string) {
  const staff = await prisma.staff.findMany({
    where: {
      salonId,
      active: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Add ownership information to each staff member
  const staffWithOwnership = await Promise.all(
    staff.map(async (staffMember) => {
      const isOwner = await prisma.membership.findFirst({
        where: {
          userId: staffMember.userId,
          salonId,
          role: "OWNER",
        },
      });

      return {
        ...staffMember,
        isOwner: !!isOwner,
      };
    })
  );

  return staffWithOwnership;
}

// Create staff profile when user is assigned STAFF role
export async function createStaffProfile(
  userId: string,
  salonId: string,
  data: {
    phone?: string;
    color?: string;
    notes?: string;
  }
) {
  return prisma.staff.create({
    data: {
      userId,
      salonId,
      phone: data.phone,
      color: data.color || generateRandomStaffColor(),
      notes: data.notes,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

// Update staff profile
export async function updateStaffProfile(
  staffId: string,
  data: {
    phone?: string;
    color?: string;
    active?: boolean;
    notes?: string;
  }
) {
  return prisma.staff.update({
    where: { id: staffId },
    data,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

// Add user as staff to salon (creates membership and staff profile)
export async function addStaffToSalon(
  userId: string,
  salonId: string,
  userData: {
    phone?: string;
    color?: string;
    notes?: string;
  }
) {
  return prisma.$transaction(async (tx) => {
    // Create membership
    const membership = await tx.membership.create({
      data: {
        userId,
        salonId,
        role: Role.STAFF,
      },
    });

    // Create staff profile
    const staff = await tx.staff.create({
      data: {
        userId,
        salonId,
        phone: userData.phone,
        color: userData.color || generateRandomStaffColor(),
        notes: userData.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { membership, staff };
  });
}

// Remove staff from salon (deactivates staff profile and removes membership)
export async function removeStaffFromSalon(userId: string, salonId: string) {
  return prisma.$transaction(async (tx) => {
    // Deactivate staff profile
    await tx.staff.updateMany({
      where: {
        userId,
        salonId,
      },
      data: {
        active: false,
      },
    });

    // Remove STAFF membership
    await tx.membership.deleteMany({
      where: {
        userId,
        salonId,
        role: Role.STAFF,
      },
    });
  });
}

// Check if user has staff profile in salon
export async function hasStaffProfile(userId: string, salonId: string) {
  const staff = await prisma.staff.findUnique({
    where: {
      salonId_userId: {
        salonId,
        userId,
      },
    },
  });
  return !!staff && staff.active;
}
