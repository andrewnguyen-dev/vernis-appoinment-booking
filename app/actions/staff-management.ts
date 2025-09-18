"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { isOwner } from "@/lib/user-utils";
import {
  addStaffToSalon,
  updateStaffProfile,
  removeStaffFromSalon,
  generateRandomStaffColor,
} from "@/lib/staff-utils";
import prisma from "@/db";

export async function addStaffToSalonAction(
  salonId: string,
  data: {
    email: string;
    phone?: string;
    notes?: string;
  }
) {
  try {
    const session = await requireOwnerAuth();
    
    // Verify the user owns this salon
    const userIsOwner = await isOwner(session.user.id, salonId);
    if (!userIsOwner) {
      return { error: "Unauthorized: You don't own this salon" };
    }

    // Check if user with this email exists
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return { error: "User not found. Please ask the staff member to create an account first." };
    }

    // Check if user is already staff in this salon
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_salonId: {
          userId: user.id,
          salonId,
        },
      },
    });

    if (existingMembership) {
      return { error: "User is already a member of this salon" };
    }

    // Add staff to salon
    const result = await addStaffToSalon(user.id, salonId, {
      phone: data.phone,
      color: generateRandomStaffColor(),
      notes: data.notes,
    });

    revalidatePath("/staffs");
    return { success: true, data: result };
  } catch (error) {
    console.error("Error adding staff to salon:", error);
    return { error: "Failed to add staff member" };
  }
}

export async function updateStaffProfileAction(
  staffId: string,
  data: {
    phone?: string;
    color?: string;
    active?: boolean;
    notes?: string;
  }
) {
  try {
    const session = await requireOwnerAuth();

    // Get the staff profile and verify ownership
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { salon: true },
    });

    if (!staff) {
      return { error: "Staff member not found" };
    }

    // Verify the user owns this salon
    const userIsOwner = await isOwner(session.user.id, staff.salonId);
    if (!userIsOwner) {
      return { error: "Unauthorized: You don't own this salon" };
    }

    const result = await updateStaffProfile(staffId, data);

    revalidatePath("/staffs");
    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating staff profile:", error);
    return { error: "Failed to update staff profile" };
  }
}

export async function removeStaffFromSalonAction(
  userId: string,
  staffId: string
) {
  try {
    const session = await requireOwnerAuth();

    // Get the staff profile and verify ownership
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { salon: true },
    });

    if (!staff) {
      return { error: "Staff member not found" };
    }

    // Verify the user owns this salon
    const userIsOwner = await isOwner(session.user.id, staff.salonId);
    if (!userIsOwner) {
      return { error: "Unauthorized: You don't own this salon" };
    }

    // Cannot remove the owner
    const targetIsOwner = await isOwner(userId, staff.salonId);
    if (targetIsOwner) {
      return { error: "Cannot remove salon owner" };
    }

    await removeStaffFromSalon(userId, staff.salonId);

    revalidatePath("/staffs");
    return { success: true };
  } catch (error) {
    console.error("Error removing staff from salon:", error);
    return { error: "Failed to remove staff member" };
  }
}
