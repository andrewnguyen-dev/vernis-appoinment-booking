"use server";

import crypto from "node:crypto";

import prisma from "@/db";
import { formatInTimeZone } from "date-fns-tz";
import { PaymentKind, PaymentProvider, PaymentStatus } from "@prisma/client";
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

interface MetadataExtras {
  capturePercentage: number;
  captureAmountCents: number;
  remainingBalanceCents: number;
}

function serializeMetadata(
  booking: BookingFormData,
  totalDuration: number,
  totalPrice: number,
  extras: MetadataExtras,
): string {
  const payload = {
    salonSlug: booking.salonSlug,
    serviceIds: booking.serviceIds,
    date: booking.date,
    time: booking.time,
    totalDuration,
    totalPrice,
    capturePercentage: extras.capturePercentage,
    captureAmountCents: extras.captureAmountCents,
    remainingBalanceCents: extras.remainingBalanceCents,
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
  capturePercentage: number;
  captureAmountCents: number;
  remainingBalanceCents: number;
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
    const data = JSON.parse(json) as BookingMetadataPayload;

    return {
      ...data,
      capturePercentage: data.capturePercentage ?? 100,
      captureAmountCents: data.captureAmountCents ?? data.totalPrice,
      remainingBalanceCents: data.remainingBalanceCents ?? 0,
    };
  } catch (error) {
    console.error("Failed to decode booking metadata:", error);
    return null;
  }
}

async function syncClientBillingDetails(
  clientId: string,
  customerId?: string | null,
  paymentMethodId?: string | null,
): Promise<void> {
  const updateData: {
    stripeCustomerId?: string;
    stripeDefaultPaymentMethodId?: string;
  } = {};

  if (customerId) {
    updateData.stripeCustomerId = customerId;
  }

  if (paymentMethodId) {
    updateData.stripeDefaultPaymentMethodId = paymentMethodId;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  await prisma.client.update({
    where: { id: clientId },
    data: updateData,
  });
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

    const normalizedCapturePercentage = Math.min(Math.max(salon.capturePercentage ?? 100, 0), 100);
    const minStripeChargeCents = 50;
    let captureAmountCents: number;

    if (normalizedCapturePercentage >= 100) {
      captureAmountCents = totalPrice;
    } else if (normalizedCapturePercentage <= 0) {
      captureAmountCents = 0;
    } else {
      captureAmountCents = Math.round((totalPrice * normalizedCapturePercentage) / 100);

      if (captureAmountCents > totalPrice) {
        captureAmountCents = totalPrice;
      }

      if (captureAmountCents > 0 && captureAmountCents < minStripeChargeCents) {
        captureAmountCents = Math.min(totalPrice, minStripeChargeCents);
      }
    }

    const remainingBalanceCents = Math.max(totalPrice - captureAmountCents, 0);
    const bookingToken = crypto.randomUUID();
    const metadataPayload = serializeMetadata(validatedData, totalDuration, totalPrice, {
      capturePercentage: normalizedCapturePercentage,
      captureAmountCents,
      remainingBalanceCents,
    });

    const sessionMetadata = {
      booking_payload: metadataPayload,
      booking_token: bookingToken,
      salon_id: salon.id,
      salon_slug: salon.slug,
    } satisfies Record<string, string>;

    const stripe = getStripeServerClient();

    if (captureAmountCents === 0) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "setup",
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: bookingToken,
          metadata: sessionMetadata,
          customer_email: validatedData.customer.email ?? undefined,
          customer_creation: "always",
          setup_intent_data: {
            metadata: sessionMetadata,
          },
        },
        {
          stripeAccount: salon.stripeAccountId,
        },
      );

      return {
        success: true,
        sessionUrl: session.url ?? undefined,
      };
    }

    const platformFeeAmount = captureAmountCents > 0
      ? calculatePlatformFee(captureAmountCents, {
          platformFeePercent: salon.platformFeePercent,
          platformFeeMinCents: salon.platformFeeMinCents,
        })
      : 0;

    const paymentIntentData: {
      application_fee_amount?: number;
      metadata: Record<string, string>;
      setup_future_usage?: "off_session";
    } = {
      metadata: sessionMetadata,
    };

    if (platformFeeAmount > 0) {
      paymentIntentData.application_fee_amount = platformFeeAmount;
    }

    if (normalizedCapturePercentage < 100) {
      paymentIntentData.setup_future_usage = "off_session";
    }

    const serviceSummary = services.map((service) => service.name).join(", ");

    const lineItems = normalizedCapturePercentage >= 100
      ? services.map((service) => ({
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: service.priceCents,
            product_data: {
              name: service.name,
              description: service.description ?? undefined,
            },
          },
        }))
      : [
          {
            quantity: 1,
            price_data: {
              currency: "aud",
              unit_amount: captureAmountCents,
              product_data: {
                name: `Booking deposit (${normalizedCapturePercentage}% due now)`,
                description: serviceSummary ? `Services: ${serviceSummary}` : undefined,
              },
            },
          },
        ];

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        payment_intent_data: paymentIntentData,
        metadata: sessionMetadata,
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
        expand: ["payment_intent", "setup_intent"],
      },
      {
        stripeAccount: salon.stripeAccountId,
      },
    );

    const paymentKindMetadata =
      (session.metadata?.payment_kind as PaymentKind | undefined) ??
      (typeof session.payment_intent !== "string"
        ? (session.payment_intent?.metadata?.payment_kind as PaymentKind | undefined)
        : undefined);

    const appointmentIdFromMetadata =
      session.metadata?.appointment_id ??
      (typeof session.payment_intent !== "string"
        ? session.payment_intent?.metadata?.appointment_id
        : undefined);

    if (paymentKindMetadata === PaymentKind.REMAINING_BALANCE) {
      const appointmentRecord = existingPayment?.appointment ??
        (appointmentIdFromMetadata
          ? await prisma.appointment.findUnique({
              where: { id: appointmentIdFromMetadata },
              include: {
                items: true,
                client: true,
              },
            })
          : null);

      if (!appointmentRecord) {
        return {
          success: false,
          error: "We couldn’t locate the appointment for this balance payment.",
          recoverable: false,
        };
      }

      await handleSuccessfulPayment(sessionId, {
        appointmentId: appointmentRecord.id,
        stripeAccountId: salon.stripeAccountId,
        salonId: salon.id,
        expectedAmountCents: session.amount_total ?? undefined,
        paymentKind: PaymentKind.REMAINING_BALANCE,
      });

      const services = appointmentRecord.items
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.serviceName);

      const appointmentDate =
        session.metadata?.appointment_date ??
        formatInTimeZone(appointmentRecord.startsAt, salon.timeZone, "yyyy-MM-dd");
      const appointmentTime =
        session.metadata?.appointment_time ??
        formatInTimeZone(appointmentRecord.startsAt, salon.timeZone, "HH:mm");

      const durationMinutes = appointmentRecord.items.reduce((sum, item) => sum + item.durationMinutes, 0);
      const totalPrice = appointmentRecord.items.reduce((sum, item) => sum + item.priceCents, 0);

      const clientName = `${appointmentRecord.client.firstName} ${appointmentRecord.client.lastName ?? ""}`.trim();

      return {
        success: true,
        appointmentId: appointmentRecord.id,
        clientName,
        date: appointmentDate,
        time: appointmentTime,
        services,
        durationMinutes,
        totalPrice,
      };
    }

    const metadataSource =
      session.metadata?.booking_payload ??
      (typeof session.payment_intent !== "string"
        ? session.payment_intent?.metadata?.booking_payload
        : undefined) ??
      (typeof session.setup_intent !== "string"
        ? session.setup_intent?.metadata?.booking_payload
        : undefined);

    const metadata = decodeMetadata(metadataSource);

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

    const paymentIntent =
      typeof session.payment_intent === "string" ? null : session.payment_intent ?? null;
    const setupIntent = typeof session.setup_intent === "string" ? null : session.setup_intent ?? null;

    const sessionMode = session.mode ?? (metadata.captureAmountCents === 0 ? "setup" : "payment");
    const isPaymentComplete =
      sessionMode === "payment" && session.status === "complete" && session.payment_status === "paid";
    const setupStatus = setupIntent?.status ?? null;
    const isSetupComplete = sessionMode === "setup" && session.status === "complete" && setupStatus === "succeeded";

    const customerId =
      (typeof paymentIntent?.customer === "string" && paymentIntent.customer) ||
      (typeof setupIntent?.customer === "string" && setupIntent.customer) ||
      (typeof session.customer === "string" ? session.customer : undefined);
    const paymentMethodId =
      (typeof paymentIntent?.payment_method === "string" && paymentIntent.payment_method) ||
      (typeof setupIntent?.payment_method === "string" && setupIntent.payment_method) ||
      undefined;

    const paymentKind = metadata.captureAmountCents === 0
      ? PaymentKind.SETUP_ONLY
      : metadata.remainingBalanceCents > 0
        ? PaymentKind.BOOKING_DEPOSIT
        : PaymentKind.FULL_PAYMENT;

    if (existingPayment?.appointment) {
      if (sessionMode === "payment" && isPaymentComplete) {
        await handleSuccessfulPayment(sessionId, {
          appointmentId: existingPayment.appointment.id,
          stripeAccountId: salon.stripeAccountId,
          salonId: salon.id,
          expectedAmountCents: metadata.captureAmountCents,
          paymentKind,
        });
      }

      if (customerId || paymentMethodId) {
        await syncClientBillingDetails(existingPayment.appointment.client.id, customerId, paymentMethodId);
      }

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

    if (sessionMode === "payment") {
      if (!isPaymentComplete) {
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
        capturePercentage: metadata.capturePercentage,
      });

      await handleSuccessfulPayment(sessionId, {
        appointmentId: appointmentResult.appointment.id,
        stripeAccountId: salon.stripeAccountId,
        salonId: salon.id,
        expectedAmountCents: metadata.captureAmountCents,
        paymentKind,
      });

      if (customerId || paymentMethodId) {
        await syncClientBillingDetails(appointmentResult.client.id, customerId, paymentMethodId);
      }

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
    }

    if (!isSetupComplete) {
      return {
        success: false,
        error: "Stripe is still saving the payment method. Refresh this page shortly or contact the salon if it remains pending.",
        recoverable: true,
      };
    }

    const appointmentResult = await createAppointmentRecord(bookingData, {
      skipAvailabilityCheck: true,
      revalidate: false,
      capturePercentage: metadata.capturePercentage,
    });

    if (customerId || paymentMethodId) {
      await syncClientBillingDetails(appointmentResult.client.id, customerId, paymentMethodId);
    }

    await prisma.payment.upsert({
      where: { stripeSessionId: session.id },
      update: {
        appointmentId: appointmentResult.appointment.id,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        amountCents: 0,
        currency: session.currency?.toUpperCase() ?? "AUD",
        kind: PaymentKind.SETUP_ONLY,
        connectedAccountId: salon.stripeAccountId,
      },
      create: {
        appointmentId: appointmentResult.appointment.id,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        amountCents: 0,
        currency: session.currency?.toUpperCase() ?? "AUD",
        kind: PaymentKind.SETUP_ONLY,
        stripeSessionId: session.id,
        connectedAccountId: salon.stripeAccountId,
      },
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
