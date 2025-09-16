"use server";

import { z } from "zod";
import prisma from "@/db";
import { getSalonBySlug } from "@/lib/tenancy";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { isTimeSlotAvailable } from "@/lib/availability";

// Validation schema for booking data
const BookingSchema = z.object({
  salonSlug: z.string().min(1),
  serviceIds: z.array(z.string()).min(1, "At least one service must be selected"),
  date: z.string(),
  time: z.string(),
  customer: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
  totalDuration: z.number().positive(),
  totalPrice: z.number().positive(),
});

export type BookingFormData = z.infer<typeof BookingSchema>;

export async function createAppointment(data: BookingFormData) {
  try {
    // Validate input data
    const validatedData = BookingSchema.parse(data);
    
    // Get salon
    const salon = await getSalonBySlug(validatedData.salonSlug);
    if (!salon) {
      return {
        success: false,
        error: "Salon not found",
      };
    }

    // Get services and validate they belong to the salon
    const services = await prisma.service.findMany({
      where: {
        id: { in: validatedData.serviceIds },
        salonId: salon.id,
        active: true,
      },
      include: {
        category: true,
      },
    });

    if (services.length !== validatedData.serviceIds.length) {
      return {
        success: false,
        error: "One or more selected services are invalid",
      };
    }

    // Calculate actual total duration and price from database
    const actualTotalDuration = services.reduce((sum, service) => sum + service.durationMinutes, 0);
    const actualTotalPrice = services.reduce((sum, service) => sum + service.priceCents, 0);

    // Validate totals match what was sent from frontend
    if (actualTotalDuration !== validatedData.totalDuration || actualTotalPrice !== validatedData.totalPrice) {
      return {
        success: false,
        error: "Price or duration mismatch. Please refresh and try again.",
      };
    }

    // Parse appointment start time in the salon's timezone
    // Create the date in the salon's timezone and convert to UTC for database storage
    const localDateTime = `${validatedData.date}T${validatedData.time}`;
    const appointmentDate = fromZonedTime(localDateTime, salon.timeZone);
    const appointmentEndTime = new Date(appointmentDate.getTime() + actualTotalDuration * 60000);

    // Check if the time slot is still available considering salon capacity
    const availabilityCheck = await isTimeSlotAvailable(
      salon.id,
      validatedData.date,
      validatedData.time,
      actualTotalDuration
    );

    if (!availabilityCheck.available) {
      const capacityInfo = availabilityCheck.capacityInfo;
      const capacityMessage = capacityInfo 
        ? ` (${capacityInfo.used}/${capacityInfo.total} slots filled)`
        : "";
      
      return {
        success: false,
        error: `This time slot is no longer available${capacityMessage}. Please select a different time.`,
      };
    }

    // Create or find client
    let client = null;
    if (validatedData.customer.email) {
      client = await prisma.client.findFirst({
        where: {
          salonId: salon.id,
          email: validatedData.customer.email,
        },
      });
    }

    if (!client) {
      client = await prisma.client.create({
        data: {
          salonId: salon.id,
          firstName: validatedData.customer.firstName,
          lastName: validatedData.customer.lastName || null,
          email: validatedData.customer.email || null,
          phone: validatedData.customer.phone || null,
          notes: validatedData.customer.notes || null,
        },
      });
    } else {
      // Update existing client with new information
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          firstName: validatedData.customer.firstName,
          lastName: validatedData.customer.lastName || client.lastName,
          phone: validatedData.customer.phone || client.phone,
          notes: validatedData.customer.notes || client.notes,
        },
      });
    }

    // Create appointment with transaction
    const appointment = await prisma.$transaction(async (tx) => {
      // Create the appointment
      const newAppointment = await tx.appointment.create({
        data: {
          salonId: salon.id,
          clientId: client.id,
          startsAt: appointmentDate,
          endsAt: appointmentEndTime,
          status: "BOOKED",
          notes: validatedData.customer.notes || null,
        },
      });

      // Create appointment items for each service
      const appointmentItems = await Promise.all(
        services.map((service, index) =>
          tx.appointmentItem.create({
            data: {
              appointmentId: newAppointment.id,
              serviceId: service.id,
              serviceName: service.name,
              priceCents: service.priceCents,
              durationMinutes: service.durationMinutes,
              sortOrder: index,
            },
          })
        )
      );

      return { ...newAppointment, items: appointmentItems };
    });

    // Revalidate the availability cache
    revalidatePath(`/${validatedData.salonSlug}/book`);

    return {
      success: true,
      data: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        client: {
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
        },
        services: services.map(s => s.name),
        totalPrice: actualTotalPrice,
      },
    };
  } catch (error) {
    console.error("Error creating appointment:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid form data: " + error.issues.map((issue) => issue.message).join(", "),
      };
    }
    
    return {
      success: false,
      error: "Failed to create appointment. Please try again.",
    };
  }
}
