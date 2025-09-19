"use server"

import { z } from "zod"
import prisma from "@/db"
import { requireOwnerAuth } from "@/lib/auth-utils"
import { getUserSalon } from "@/lib/user-utils"
import { isTimeSlotAvailable } from "@/lib/availability"
import { revalidatePath } from "next/cache"

// Validation schemas
const UpdateAppointmentSchema = z.object({
  appointmentId: z.string().cuid(),
  status: z.enum(["BOOKED", "COMPLETED", "CANCELED"]),
  notes: z.string().optional(),
  assignedStaffId: z.string().cuid().optional().nullable(),
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
    
    // Get user's salon to verify ownership
    const salon = await getUserSalon(session.user.id, 'OWNER')

    if (!salon) {
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

    if (existingAppointment.salonId !== salon.id) {
      return {
        success: false,
        error: "You don't have permission to update this appointment"
      }
    }

    // If assigning a staff, verify the staff belongs to the salon
    if (validatedData.assignedStaffId) {
      const staff = await prisma.staff.findUnique({
        where: { id: validatedData.assignedStaffId },
      })

      if (!staff || staff.salonId !== existingAppointment.salonId) {
        return {
          success: false,
          error: "Invalid staff assignment"
        }
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
          assignedStaffId: validatedData.assignedStaffId || null,
        },
        include: {
          client: true,
          assignedStaff: {
            select: {
              id: true,
              userId: true,
              color: true,
              user: {
                select: {
                  name: true,
                },
              },
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
    
    // Get user's salon to verify ownership
    const salon = await getUserSalon(session.user.id, 'OWNER')

    if (!salon) {
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

    if (existingAppointment.salonId !== salon.id) {
      return {
        success: false,
        error: "You don't have permission to update this appointment"
      }
    }

    const newStartTime = new Date(validatedData.startsAt)
    const newEndTime = new Date(validatedData.endsAt)

    // Calculate duration for availability check
    const durationMinutes = Math.round((newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60))

    // Format date and time for availability check
    const appointmentDate = newStartTime.toISOString().split('T')[0] // YYYY-MM-DD
    const appointmentTime = newStartTime.toTimeString().slice(0, 5) // HH:MM

    // Check if the new time slot is available considering salon capacity
    // Exclude the current appointment from the availability check
    const availabilityCheck = await isTimeSlotAvailable(
      existingAppointment.salonId,
      appointmentDate,
      appointmentTime,
      durationMinutes,
      [validatedData.appointmentId] // Exclude current appointment
    )

    if (!availabilityCheck.available) {
      const capacityInfo = availabilityCheck.capacityInfo
      const capacityMessage = capacityInfo 
        ? ` (${capacityInfo.used}/${capacityInfo.total} slots filled)`
        : ""
      
      return {
        success: false,
        error: `The new time slot is not available${capacityMessage}. Please select a different time.`
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
        assignedStaff: {
          select: {
            id: true,
            userId: true,
            color: true,
            user: {
              select: {
                name: true,
              },
            },
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
    
    // Get user's salon to verify ownership
    const salon = await getUserSalon(session.user.id, 'OWNER')

    if (!salon) {
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

    if (existingAppointment.salonId !== salon.id) {
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
    
    // Get user's salon to verify ownership
    const salon = await getUserSalon(session.user.id, 'OWNER')

    if (!salon) {
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
        assignedStaff: {
          select: {
            id: true,
            userId: true,
            color: true,
            user: {
              select: {
                name: true,
              },
            },
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

    if (appointment.salonId !== salon.id) {
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

// Get all active staff for a salon
export async function getSalonStaff(salonId?: string) {
  try {
    // Ensure user is authenticated and has owner role
    const session = await requireOwnerAuth()
    
    // Get user's salon to verify ownership
    const salon = await getUserSalon(session.user.id, 'OWNER')

    if (!salon) {
      return {
        success: false,
        error: "No salon found for this user"
      }
    }

    // Use provided salonId or default to first salon
    const targetSalonId = salonId || salon.id

    if (targetSalonId !== salon.id) {
      return {
        success: false,
        error: "You don't have permission to view this salon's staff"
      }
    }

    const staff = await prisma.staff.findMany({
      where: {
        salonId: targetSalonId,
        active: true,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    })

    return {
      success: true,
      data: staff
    }

  } catch (error) {
    console.error("Error fetching salon staff:", error)
    
    return {
      success: false,
      error: "Failed to fetch salon staff"
    }
  }
}
