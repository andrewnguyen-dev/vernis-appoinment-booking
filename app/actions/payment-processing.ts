"use server";

import { z } from "zod";
import { stripe } from "@/lib/stripe";
import prisma from "@/db";
import { DepositType } from "@prisma/client";

// Schema for creating a payment intent
const createPaymentIntentSchema = z.object({
  salonId: z.string(),
  services: z.array(z.object({
    id: z.string(),
    priceCents: z.number(),
    name: z.string(),
  })),
  selectedDateTime: z.date(),
  staffId: z.string().optional(),
});

type CreatePaymentIntentData = z.infer<typeof createPaymentIntentSchema>;

/**
 * Calculate deposit amount based on salon settings
 */
function calculateDepositAmount(totalCents: number, salon: { depositType: DepositType; depositValue: number; requireDeposit: boolean }) {
  if (!salon.requireDeposit) {
    return 0;
  }

  switch (salon.depositType) {
    case "PERCENTAGE":
      return Math.round((totalCents * salon.depositValue) / 10000); // depositValue is in basis points (e.g., 2000 = 20%)
    case "FIXED_AMOUNT":
      return salon.depositValue; // depositValue is in cents
    case "AUTHORIZATION_ONLY":
      return 100; // $1.00 authorization
    default:
      return 0;
  }
}

/**
 * Create a Stripe PaymentIntent for booking deposit
 */
export async function createPaymentIntent(data: CreatePaymentIntentData) {
  try {
    const validatedData = createPaymentIntentSchema.parse(data);

    // Get salon details including Stripe Connect account and deposit settings
    const salon = await prisma.salon.findUnique({
      where: { id: validatedData.salonId },
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
        depositType: true,
        depositValue: true,
        requireDeposit: true,
        depositDescription: true,
      },
    });

    if (!salon) {
      throw new Error("Salon not found");
    }

    if (!salon.stripeAccountId) {
      throw new Error("Salon has not connected Stripe account");
    }

    // Verify all services belong to this salon
    const services = await prisma.service.findMany({
      where: {
        id: { in: validatedData.services.map(s => s.id) },
        salonId: salon.id,
      },
      select: {
        id: true,
        name: true,
        priceCents: true,
      },
    });

    if (services.length !== validatedData.services.length) {
      throw new Error("Some services not found or don't belong to this salon");
    }

    // Calculate total amount
    const totalAmountCents = services.reduce((sum, service) => sum + service.priceCents, 0);
    
    // Calculate deposit amount
    const depositAmountCents = calculateDepositAmount(totalAmountCents, salon);
    
    // Determine if this is full payment or deposit
    const isFullPayment = depositAmountCents === totalAmountCents || depositAmountCents === 0;
    const chargeAmountCents = isFullPayment ? totalAmountCents : depositAmountCents;

    if (chargeAmountCents <= 0) {
      throw new Error("Invalid payment amount");
    }

    // Create description
    const serviceNames = services.map(s => s.name).join(", ");
    const description = salon.requireDeposit && !isFullPayment 
      ? `${salon.depositDescription} for ${serviceNames} at ${salon.name}`
      : `Payment for ${serviceNames} at ${salon.name}`;

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmountCents,
      currency: "aud",
      application_fee_amount: Math.round(chargeAmountCents * 0.03), // 3% platform fee
      transfer_data: {
        destination: salon.stripeAccountId,
      },
      metadata: {
        salon_id: salon.id,
        total_amount_cents: totalAmountCents.toString(),
        is_deposit: (!isFullPayment).toString(),
        service_ids: validatedData.services.map(s => s.id).join(","),
        selected_datetime: validatedData.selectedDateTime.toISOString(),
        staff_id: validatedData.staffId || "",
      },
      description,
    }, {
      stripeAccount: salon.stripeAccountId, // Create PaymentIntent on connected account
    });

    return {
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: chargeAmountCents,
        currency: paymentIntent.currency,
      },
      paymentDetails: {
        totalAmount: totalAmountCents,
        depositAmount: depositAmountCents,
        isDeposit: !isFullPayment,
        description,
      },
    };

  } catch (error) {
    console.error("Error creating payment intent:", error);
    if (error instanceof z.ZodError) {
      throw new Error("Invalid payment data provided");
    }
    throw error;
  }
}

/**
 * Verify payment and create appointment
 */
export async function verifyPaymentAndCreateAppointment(
  paymentIntentId: string,
  clientDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }
) {
  try {
    // Retrieve the PaymentIntent to verify it was paid
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment has not been completed");
    }

    const metadata = paymentIntent.metadata;
    const salonId = metadata.salon_id;
    const totalAmountCents = parseInt(metadata.total_amount_cents);
    const isDeposit = metadata.is_deposit === "true";
    const serviceIds = metadata.service_ids.split(",");
    const selectedDateTime = new Date(metadata.selected_datetime);
    const staffId = metadata.staff_id || null;

    // Start a database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create or find client
      let client = await tx.client.findUnique({
        where: {
          salonId_email: {
            salonId,
            email: clientDetails.email,
          },
        },
      });

      if (!client) {
        client = await tx.client.create({
          data: {
            salonId,
            firstName: clientDetails.firstName,
            lastName: clientDetails.lastName,
            email: clientDetails.email,
            phone: clientDetails.phone,
          },
        });
      } else {
        // Update existing client info
        client = await tx.client.update({
          where: { id: client.id },
          data: {
            firstName: clientDetails.firstName,
            lastName: clientDetails.lastName,
            phone: clientDetails.phone,
          },
        });
      }

      // Get service details for appointment creation
      const services = await tx.service.findMany({
        where: { id: { in: serviceIds } },
        select: {
          id: true,
          name: true,
          priceCents: true,
          durationMinutes: true,
        },
      });

      // Create appointment - calculate duration and end time
      const totalDurationMinutes = services.reduce((sum, service) => sum + service.durationMinutes, 0);
      const endDateTime = new Date(selectedDateTime.getTime() + totalDurationMinutes * 60 * 1000);
      
      const appointment = await tx.appointment.create({
        data: {
          salonId,
          clientId: client.id,
          assignedStaffId: staffId,
          startsAt: selectedDateTime,
          endsAt: endDateTime,
          status: "BOOKED",
        },
      });

      // Create appointment service items
      await tx.appointmentItem.createMany({
        data: services.map((service, index) => ({
          appointmentId: appointment.id,
          serviceId: service.id,
          serviceName: service.name, // Snapshot the name
          priceCents: service.priceCents,
          durationMinutes: service.durationMinutes,
          sortOrder: index,
        })),
      });

      // Create payment record
      await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          amountCents: paymentIntent.amount,
          totalAmountCents,
          isDeposit,
          currency: paymentIntent.currency.toUpperCase(),
          provider: "STRIPE",
          providerRef: paymentIntentId,
          status: "PAID",
          capturedAt: new Date(),
        },
      });

      return appointment;
    });

    return {
      success: true,
      appointment: result,
    };

  } catch (error) {
    console.error("Error verifying payment and creating appointment:", error);
    throw error;
  }
}