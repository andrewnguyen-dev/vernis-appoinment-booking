"use server";

import { z } from "zod";
import prisma from "@/db";
import { getSalonBySlug } from "@/lib/tenancy";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { isTimeSlotAvailable } from "@/lib/availability";
import type { Appointment, Client, Service } from "@prisma/client";
import { bookingFormSchema, type BookingFormData } from "@/helpers/zod/booking-schema";

interface CreateAppointmentOptions {
  skipAvailabilityCheck?: boolean;
  revalidate?: boolean;
}

interface AppointmentCreationContext {
  salonId: string;
  salonSlug: string;
  salonTimeZone: string;
  services: Array<Service & { category: { name: string } | null }>;
  appointmentDate: Date;
  appointmentEndTime: Date;
  totalDuration: number;
  totalPrice: number;
}

interface AppointmentCreationResult {
  appointment: Appointment & { items: Array<{ id: string; serviceName: string; priceCents: number; durationMinutes: number; sortOrder: number }> };
  client: Client;
  services: Array<Service & { category: { name: string } | null }>;
  context: AppointmentCreationContext;
}

async function prepareAppointmentContext(validatedData: BookingFormData): Promise<AppointmentCreationContext | null> {
  const salon = await getSalonBySlug(validatedData.salonSlug);
  if (!salon) {
    return null;
  }

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
    throw new Error("One or more selected services are invalid");
  }

  const totalDuration = services.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = services.reduce((sum, service) => sum + service.priceCents, 0);

  if (totalDuration !== validatedData.totalDuration || totalPrice !== validatedData.totalPrice) {
    throw new Error("Price or duration mismatch. Please refresh and try again.");
  }

  const localDateTime = `${validatedData.date}T${validatedData.time}`;
  const appointmentDate = fromZonedTime(localDateTime, salon.timeZone);
  const appointmentEndTime = new Date(appointmentDate.getTime() + totalDuration * 60000);

  return {
    salonId: salon.id,
    salonSlug: salon.slug,
    salonTimeZone: salon.timeZone,
    services,
    appointmentDate,
    appointmentEndTime,
    totalDuration,
    totalPrice,
  };
}

async function ensureClient(
  salonId: string,
  booking: BookingFormData
): Promise<Client> {
  const customer = booking.customer;

  if (customer.email) {
    const existingClient = await prisma.client.findFirst({
      where: {
        salonId,
        email: customer.email,
      },
    });

    if (existingClient) {
      return prisma.client.update({
        where: { id: existingClient.id },
        data: {
          firstName: customer.firstName,
          lastName: customer.lastName || existingClient.lastName,
          phone: customer.phone || existingClient.phone,
          notes: customer.notes || existingClient.notes,
        },
      });
    }
  }

  return prisma.client.create({
    data: {
      salonId,
      firstName: customer.firstName,
      lastName: customer.lastName || null,
      email: customer.email || null,
      phone: customer.phone || null,
      notes: customer.notes || null,
    },
  });
}

export async function createAppointmentRecord(
  data: BookingFormData,
  options: CreateAppointmentOptions = {}
): Promise<AppointmentCreationResult> {
  const validatedData = bookingFormSchema.parse(data);
  const context = await prepareAppointmentContext(validatedData);

  if (!context) {
    throw new Error("Salon not found");
  }

  if (!options.skipAvailabilityCheck) {
    const availabilityCheck = await isTimeSlotAvailable(
      context.salonId,
      validatedData.date,
      validatedData.time,
      context.totalDuration,
    );

    if (!availabilityCheck.available) {
      const capacityInfo = availabilityCheck.capacityInfo;
      const capacityMessage = capacityInfo
        ? ` (${capacityInfo.used}/${capacityInfo.total} slots filled)`
        : "";

      throw new Error(`This time slot is no longer available${capacityMessage}. Please select a different time.`);
    }
  }

  const client = await ensureClient(context.salonId, validatedData);

  const appointment = await prisma.$transaction(async (tx) => {
    const newAppointment = await tx.appointment.create({
      data: {
        salonId: context.salonId,
        clientId: client.id,
        startsAt: context.appointmentDate,
        endsAt: context.appointmentEndTime,
        status: "PENDING",
        notes: validatedData.customer.notes || null,
      },
    });

    const items = await Promise.all(
      context.services.map((service, index) =>
        tx.appointmentItem.create({
          data: {
            appointmentId: newAppointment.id,
            serviceId: service.id,
            serviceName: service.name,
            priceCents: service.priceCents,
            durationMinutes: service.durationMinutes,
            sortOrder: index,
          },
        }),
      ),
    );

    return { ...newAppointment, items };
  });

  if (options.revalidate ?? true) {
    revalidatePath(`/${validatedData.salonSlug}/book`);
  }

  return {
    appointment,
    client,
    services: context.services,
    context,
  };
}

export async function createAppointment(data: BookingFormData) {
  try {
    const result = await createAppointmentRecord(data);

    return {
      success: true,
      data: {
        appointmentId: result.appointment.id,
        startsAt: result.appointment.startsAt,
        endsAt: result.appointment.endsAt,
        client: {
          firstName: result.client.firstName,
          lastName: result.client.lastName,
          email: result.client.email,
        },
        services: result.services.map((service) => service.name),
        totalPrice: result.context.totalPrice,
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
      error: error instanceof Error ? error.message : "Failed to create appointment. Please try again.",
    };
  }
}
