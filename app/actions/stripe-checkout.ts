"use server";

import crypto from "node:crypto";

import prisma from "@/db";
import { z } from "zod";
import { bookingFormSchema, type BookingFormData } from "@/helpers/zod/booking-schema";
import { getSalonBySlug } from "@/lib/tenancy";
import { ensureAbsoluteStripeUrl, resolveStripePlatformBaseUrl, calculatePlatformFee } from "@/lib/services/stripe-utils";
import { getStripeServerClient } from "@/lib/stripe";
import { isAccountReadyForPayments } from "@/lib/services/stripe-connect-service";
import { isTimeSlotAvailable } from "@/lib/availability";
import { createAppointmentRecord } from "@/app/actions/appointment";
import { handleSuccessfulPayment } from "@/lib/services/stripe-payment-service";

export interface CreateBookingSessionResult {
  success: boolean;
  sessionUrl?: string;
  error?: string;
}

function serializeMetadata(booking: BookingFormData, totalDuration: number, totalPrice: number): string {
  const payload = {
    salonSlug: booking.salonSlug,
    serviceIds: booking.serviceIds,
    date: booking.date,
    time: booking.time,
    totalDuration,
    totalPrice,
    customer: {
      firstName: booking.customer.firstName,
      lastName: booking.customer.lastName ?? null,
      email: booking.customer.email ?? null,
      phone: booking.customer.phone ?? null,
      notes: booking.customer.notes ?? null,
    },
  };

  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

interface BookingMetadataPayload {
  salonSlug: string;
  serviceIds: string[];
  date: string;
  time: string;
  totalDuration: number;
  totalPrice: number;
  customer: {
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
}

function decodeMetadata(payload?: string | null): BookingMetadataPayload | null {
  if (!payload) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(json) as BookingMetadataPayload;
  } catch (error) {
    console.error("Failed to decode booking metadata:", error);
    return null;
  }
}

export async function createBookingCheckoutSession(
  salonSlug: string,
  bookingData: BookingFormData
): Promise<CreateBookingSessionResult> {
  try {
    const validatedData = bookingFormSchema.parse({ ...bookingData, salonSlug });
    const salon = await getSalonBySlug(validatedData.salonSlug);

    if (!salon) {
      return { success: false, error: "Salon not found" };
    }

    if (!salon.stripeAccountId) {
      return { success: false, error: "This salon has not completed payment setup yet." };
    }

    const stripeReady = await isAccountReadyForPayments(salon.id);
    if (!stripeReady) {
      return { success: false, error: "This salon cannot accept online payments right now." };
    }

    const services = await prisma.service.findMany({
      where: {
        id: { in: validatedData.serviceIds },
        salonId: salon.id,
        active: true,
      },
    });

    if (services.length !== validatedData.serviceIds.length) {
      return { success: false, error: "One or more selected services are invalid." };
    }

    const totalDuration = services.reduce((sum, service) => sum + service.durationMinutes, 0);
    const totalPrice = services.reduce((sum, service) => sum + service.priceCents, 0);

    if (
      totalDuration !== validatedData.totalDuration ||
      totalPrice !== validatedData.totalPrice
    ) {
      return { success: false, error: "Price or duration mismatch. Please refresh and try again." };
    }

    const slotAvailable = await isTimeSlotAvailable(
      salon.id,
      validatedData.date,
      validatedData.time,
      totalDuration,
    );

    if (!slotAvailable.available) {
      const capacityInfo = slotAvailable.capacityInfo;
      const capacityMessage = capacityInfo
        ? ` (${capacityInfo.used}/${capacityInfo.total} slots filled)`
        : "";

      return {
        success: false,
        error: `This time slot is no longer available${capacityMessage}. Please choose another.`,
      };
    }

    const baseUrl = resolveStripePlatformBaseUrl();
    const successUrl = ensureAbsoluteStripeUrl(
      `/${encodeURIComponent(validatedData.salonSlug)}/book/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      baseUrl,
    );
    const cancelUrl = ensureAbsoluteStripeUrl(
      `/${encodeURIComponent(validatedData.salonSlug)}/book?checkout=cancelled`,
      baseUrl,
    );

    const platformFeeAmount = calculatePlatformFee(totalPrice, {
      platformFeePercent: salon.platformFeePercent,
      platformFeeMinCents: salon.platformFeeMinCents,
    });

    const metadataPayload = serializeMetadata(validatedData, totalDuration, totalPrice);
    const bookingToken = crypto.randomUUID();

    const stripe = getStripeServerClient();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: services.map((service) => ({
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: service.priceCents,
            product_data: {
              name: service.name,
              description: service.description ?? undefined,
            },
          },
        })),
        payment_intent_data: {
          application_fee_amount: platformFeeAmount,
          metadata: {
            booking_payload: metadataPayload,
            booking_token: bookingToken,
            salon_id: salon.id,
            salon_slug: salon.slug,
          },
        },
        metadata: {
          booking_payload: metadataPayload,
          booking_token: bookingToken,
          salon_id: salon.id,
          salon_slug: salon.slug,
        },
        client_reference_id: bookingToken,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: validatedData.customer.email ?? undefined,
      },
      {
        stripeAccount: salon.stripeAccountId,
      },
    );

    return {
      success: true,
      sessionUrl: session.url ?? undefined,
    };
  } catch (error) {
    console.error("Failed to create booking checkout session:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid booking details. Please review the form and try again.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to start checkout. Please try again later.",
    };
  }
}

export interface FinalizeBookingSessionResult {
  success: boolean;
  appointmentId?: string;
  clientName?: string;
  date?: string;
  time?: string;
  services?: string[];
  durationMinutes?: number;
  totalPrice?: number;
  error?: string;
  recoverable?: boolean;
}

export async function finalizeBookingCheckoutSession(
  sessionId: string,
  salonSlug: string
): Promise<FinalizeBookingSessionResult> {
  try {
    if (!sessionId) {
      return { success: false, error: "Missing checkout session identifier.", recoverable: false };
    }

    const salon = await prisma.salon.findUnique({
      where: { slug: salonSlug },
      select: {
        id: true,
        slug: true,
        stripeAccountId: true,
        timeZone: true,
      },
    });

    if (!salon?.stripeAccountId) {
      return { success: false, error: "Salon is not configured for online payments.", recoverable: false };
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { stripeSessionId: sessionId },
      include: {
        appointment: {
          include: {
            items: true,
            client: true,
          },
        },
      },
    });

    const stripe = getStripeServerClient();
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {
        expand: ["payment_intent"],
      },
      {
        stripeAccount: salon.stripeAccountId,
      },
    );

    const metadata = decodeMetadata(
      session.metadata?.booking_payload ??
        (typeof session.payment_intent !== "string"
          ? session.payment_intent?.metadata?.booking_payload
          : undefined),
    );

    if (!metadata) {
      return { success: false, error: "Checkout session is missing booking details.", recoverable: false };
    }

    if (metadata.salonSlug !== salonSlug) {
      return { success: false, error: "Booking does not match this salon.", recoverable: false };
    }

    const customerEmail = metadata.customer.email;

    if (!customerEmail) {
      return {
        success: false,
        error: "Booking details were missing a customer email. Please start the checkout again.",
        recoverable: false,
      };
    }

    const bookingData: BookingFormData = {
      salonSlug,
      serviceIds: metadata.serviceIds,
      date: metadata.date,
      time: metadata.time,
      totalDuration: metadata.totalDuration,
      totalPrice: metadata.totalPrice,
      customer: {
        firstName: metadata.customer.firstName,
        lastName: metadata.customer.lastName ?? undefined,
        email: customerEmail,
        phone: metadata.customer.phone ?? undefined,
        notes: metadata.customer.notes ?? undefined,
      },
    };

    const appointmentId = existingPayment?.appointmentId;

    if (existingPayment && existingPayment.appointment) {
      await handleSuccessfulPayment(sessionId, {
        appointmentId,
        stripeAccountId: salon.stripeAccountId,
        salonId: salon.id,
        expectedAmountCents: metadata.totalPrice,
      });

      const clientName = `${existingPayment.appointment.client.firstName} ${existingPayment.appointment.client.lastName ?? ""}`.trim();
      const services = existingPayment.appointment.items
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.serviceName);

      return {
        success: true,
        appointmentId: existingPayment.appointment.id,
        clientName,
        date: metadata.date,
        time: metadata.time,
        services,
        durationMinutes: metadata.totalDuration,
        totalPrice: metadata.totalPrice,
      };
    }

    if (session.status !== "complete" || session.payment_status !== "paid") {
      return {
        success: false,
        error:
          "Stripe is still processing this payment. Refresh this page in a few moments or contact the salon if it remains pending.",
        recoverable: true,
      };
    }

    const appointmentResult = await createAppointmentRecord(bookingData, {
      skipAvailabilityCheck: true,
      revalidate: false,
    });

    await handleSuccessfulPayment(sessionId, {
      appointmentId: appointmentResult.appointment.id,
      stripeAccountId: salon.stripeAccountId,
      salonId: salon.id,
      expectedAmountCents: metadata.totalPrice,
    });

    const clientName = `${appointmentResult.client.firstName} ${appointmentResult.client.lastName ?? ""}`.trim();

    return {
      success: true,
      appointmentId: appointmentResult.appointment.id,
      clientName,
      date: metadata.date,
      time: metadata.time,
      services: appointmentResult.services.map((service) => service.name),
      durationMinutes: metadata.totalDuration,
      totalPrice: metadata.totalPrice,
    };
  } catch (error) {
    console.error("Failed to finalize checkout session:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "We could not confirm your payment. Please contact the salon to verify.",
      recoverable: false,
    };
  }
}
