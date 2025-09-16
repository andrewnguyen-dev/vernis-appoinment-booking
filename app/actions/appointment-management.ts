"use server"

import { z } from "zod"
import prisma from "@/db"
import { requireOwnerAuth } from "@/lib/auth-utils"
import { getUserSalons } from "@/lib/user-utils"
import { revalidatePath } from "next/cache"

// Validation schemas
const UpdateAppointmentSchema = z.object({
  appointmentId: z.string().cuid(),
  status: z.enum(["BOOKED", "COMPLETED", "CANCELED"]),
  notes: z.string().optional(),
  client: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
  }),
})

const UpdateAppointmentTimeSchema = z.object({
  appointmentId: z.string().cuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})

const DeleteAppointmentSchema = z.object({
  appointmentId: z.string().cuid(),
})

export type UpdateAppointmentData = z.infer<typeof UpdateAppointmentSchema>
export type UpdateAppointmentTimeData = z.infer<typeof UpdateAppointmentTimeSchema>

// Update appointment details (status, notes, client info)
export async function updateAppointment(data: UpdateAppointmentData) {
  try {
    // Validate input
    const validatedData = UpdateAppointmentSchema.parse(data)
    
    // Ensure user is authenticated and has owner role
    const session = await requireOwnerAuth()
    
    // Get user's salons to verify ownership
    const salons = await getUserSalons(session.user.id, 'OWNER')
    const salonIds = salons.map(salon => salon.id)
    
    if (salonIds.length === 0) {
      return {
        success: false,
        error: "No salon found for this user"
      }
    }

    // Find the appointment and verify it belongs to user's salon
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: validatedData.appointmentId },
      include: {
        client: true,
        salon: true,
      },
    })

    if (!existingAppointment) {
      return {
        success: false,
        error: "Appointment not found"
      }
    }

    if (!salonIds.includes(existingAppointment.salonId)) {
      return {
        success: false,
        error: "You don't have permission to update this appointment"
      }
    }

    // Update the appointment and client in a transaction
    const updatedAppointment = await prisma.$transaction(async (tx) => {
      // Update client information
      await tx.client.update({
        where: { id: existingAppointment.clientId },
        data: {
          firstName: validatedData.client.firstName,
          lastName: validatedData.client.lastName || null,
          email: validatedData.client.email || null,
          phone: validatedData.client.phone || null,
        },
      })

      // Update appointment
      const updatedAppointment = await tx.appointment.update({
        where: { id: validatedData.appointmentId },
        data: {
          status: validatedData.status,
          notes: validatedData.notes || null,
        },
        include: {
          client: true,
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      return updatedAppointment
    })

    // Revalidate the appointments page
    revalidatePath("/appointments")

    return {
      success: true,
      data: updatedAppointment
    }

  } catch (error) {
    console.error("Error updating appointment:", error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid data: " + error.issues.map(issue => issue.message).join(", ")
      }
    }
    
    return {
      success: false,
      error: "Failed to update appointment"
    }
  }
}

// Update appointment time (for rescheduling)
export async function updateAppointmentTime(data: UpdateAppointmentTimeData) {
  try {
    // Validate input
    const validatedData = UpdateAppointmentTimeSchema.parse(data)
    
    // Ensure user is authenticated and has owner role
    const session = await requireOwnerAuth()
    
    // Get user's salons to verify ownership
    const salons = await getUserSalons(session.user.id, 'OWNER')
    const salonIds = salons.map(salon => salon.id)
    
    if (salonIds.length === 0) {
      return {
        success: false,
        error: "No salon found for this user"
      }
    }

    // Find the appointment and verify it belongs to user's salon
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: validatedData.appointmentId },
      include: { salon: true },
    })

    if (!existingAppointment) {
      return {
        success: false,
        error: "Appointment not found"
      }
    }

    if (!salonIds.includes(existingAppointment.salonId)) {
      return {
        success: false,
        error: "You don't have permission to update this appointment"
      }
    }

    const newStartTime = new Date(validatedData.startsAt)
    const newEndTime = new Date(validatedData.endsAt)

    // Check for time slot conflicts (excluding the current appointment)
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        salonId: existingAppointment.salonId,
        id: { not: validatedData.appointmentId },
        status: { in: ["BOOKED", "COMPLETED"] },
        OR: [
          {
            startsAt: { lt: newEndTime },
            endsAt: { gt: newStartTime },
          },
        ],
      },
    })

    if (conflictingAppointment) {
      return {
        success: false,
        error: "The new time slot conflicts with another appointment"
      }
    }

    // Update appointment time
    const updatedAppointment = await prisma.appointment.update({
      where: { id: validatedData.appointmentId },
      data: {
        startsAt: newStartTime,
        endsAt: newEndTime,
      },
      include: {
        client: true,
        items: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Revalidate the appointments page
    revalidatePath("/appointments")

    return {
      success: true,
      data: updatedAppointment
    }

  } catch (error) {
    console.error("Error updating appointment time:", error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid data: " + error.issues.map(issue => issue.message).join(", ")
      }
    }
    
    return {
      success: false,
      error: "Failed to update appointment time"
    }
  }
}

// Cancel appointment (soft delete)
export async function cancelAppointment(appointmentId: string) {
  try {
    // Validate input
    const validatedData = DeleteAppointmentSchema.parse({ appointmentId })
    
    // Ensure user is authenticated and has owner role
    const session = await requireOwnerAuth()
    
    // Get user's salons to verify ownership
    const salons = await getUserSalons(session.user.id, 'OWNER')
    const salonIds = salons.map(salon => salon.id)
    
    if (salonIds.length === 0) {
      return {
        success: false,
        error: "No salon found for this user"
      }
    }

    // Find the appointment and verify it belongs to user's salon
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: validatedData.appointmentId },
      include: { salon: true },
    })

    if (!existingAppointment) {
      return {
        success: false,
        error: "Appointment not found"
      }
    }

    if (!salonIds.includes(existingAppointment.salonId)) {
      return {
        success: false,
        error: "You don't have permission to cancel this appointment"
      }
    }

    // Update appointment status to cancelled
    const cancelledAppointment = await prisma.appointment.update({
      where: { id: validatedData.appointmentId },
      data: {
        status: "CANCELED",
      },
    })

    // Revalidate the appointments page
    revalidatePath("/appointments")

    return {
      success: true,
      data: cancelledAppointment
    }

  } catch (error) {
    console.error("Error cancelling appointment:", error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid data: " + error.issues.map(issue => issue.message).join(", ")
      }
    }
    
    return {
      success: false,
      error: "Failed to cancel appointment"
    }
  }
}

// Get appointment details by ID (for fetching updated data)
export async function getAppointmentById(appointmentId: string) {
  try {
    // Ensure user is authenticated and has owner role
    const session = await requireOwnerAuth()
    
    // Get user's salons to verify ownership
    const salons = await getUserSalons(session.user.id, 'OWNER')
    const salonIds = salons.map(salon => salon.id)
    
    if (salonIds.length === 0) {
      return {
        success: false,
        error: "No salon found for this user"
      }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        createdBy: {
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
            timeZone: true,
          },
        },
      },
    })

    if (!appointment) {
      return {
        success: false,
        error: "Appointment not found"
      }
    }

    if (!salonIds.includes(appointment.salonId)) {
      return {
        success: false,
        error: "You don't have permission to view this appointment"
      }
    }

    return {
      success: true,
      data: appointment
    }

  } catch (error) {
    console.error("Error fetching appointment:", error)
    
    return {
      success: false,
      error: "Failed to fetch appointment"
    }
  }
}
