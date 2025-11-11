"use server";

import Stripe from "stripe";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";

import prisma from "@/db";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import { getStripeServerClient } from "@/lib/stripe";
import { calculatePlatformFee, ensureAbsoluteStripeUrl, resolveStripePlatformBaseUrl } from "@/lib/services/stripe-utils";
import { PaymentKind, PaymentProvider, PaymentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

const ChargeBalanceSchema = z.object({
  appointmentId: z.string().cuid(),
});

interface ChargeBalanceResult {
  success: boolean;
  error?: string;
  requiresAction?: boolean;
  paymentLinkUrl?: string;
  payment?: {
    paymentIntentId: string;
    paymentId: string;
    amountCents: number;
    currency: string;
    status: PaymentStatus;
  };
}

function sumPaidAmounts(payments: Array<{ amountCents: number; status: PaymentStatus; kind: PaymentKind }>): number {
  return payments
    .filter((payment) => payment.status === PaymentStatus.PAID && payment.kind !== PaymentKind.SETUP_ONLY)
    .reduce((sum, payment) => sum + payment.amountCents, 0);
}

function sumCollectedPlatformFees(payments: Array<{ platformFeeAmount: number | null; status: PaymentStatus }>): number {
  return payments
    .filter((payment) => payment.status === PaymentStatus.PAID)
    .reduce((sum, payment) => sum + (payment.platformFeeAmount ?? 0), 0);
}

export async function chargeAppointmentBalance(data: { appointmentId: string }): Promise<ChargeBalanceResult> {
  try {
    const { appointmentId } = ChargeBalanceSchema.parse(data);

    const session = await requireOwnerAuth();
    const salon = await getUserSalon(session.user.id, "OWNER");

    if (!salon) {
      return { success: false, error: "No salon found for this user." };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        salon: {
          select: {
            id: true,
            slug: true,
            name: true,
            stripeAccountId: true,
            platformFeePercent: true,
            platformFeeMinCents: true,
            timeZone: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            stripeCustomerId: true,
            stripeDefaultPaymentMethodId: true,
          },
        },
        items: {
          select: {
            priceCents: true,
          },
        },
        payments: {
          select: {
            id: true,
            amountCents: true,
            status: true,
            kind: true,
            platformFeeAmount: true,
            stripeSessionId: true,
          },
        },
      },
    });

    if (!appointment || appointment.salonId !== salon.id) {
      return { success: false, error: "Appointment not found for this salon." };
    }

    if (!appointment.salon.stripeAccountId) {
      return { success: false, error: "Salon has not completed payment onboarding." };
    }

    const totalPrice = appointment.items.reduce((sum, item) => sum + item.priceCents, 0);
    const alreadyPaid = sumPaidAmounts(appointment.payments);
    const remainingAmount = Math.max(totalPrice - alreadyPaid, 0);

    if (remainingAmount <= 0) {
      return {
        success: true,
        payment: {
          paymentIntentId: "",
          paymentId: "",
          amountCents: 0,
          currency: "AUD",
          status: PaymentStatus.PAID,
        },
      };
    }

    const fullPlatformFee = calculatePlatformFee(totalPrice, {
      platformFeePercent: appointment.salon.platformFeePercent,
      platformFeeMinCents: appointment.salon.platformFeeMinCents,
    });
    const collectedPlatformFee = sumCollectedPlatformFees(appointment.payments);
    const remainingPlatformFee = Math.max(0, fullPlatformFee - collectedPlatformFee);
    const platformFeeForCharge = Math.min(remainingPlatformFee, remainingAmount);

    const stripe = getStripeServerClient();
    const baseUrl = resolveStripePlatformBaseUrl();
    const successUrl = ensureAbsoluteStripeUrl(
      `/${encodeURIComponent(appointment.salon.slug)}/pay/balance/success?session_id={CHECKOUT_SESSION_ID}`,
      baseUrl,
    );
    const cancelUrl = ensureAbsoluteStripeUrl(
      `/${encodeURIComponent(appointment.salon.slug)}/pay/balance/cancel`,
      baseUrl,
    );

    const appointmentDate = formatInTimeZone(appointment.startsAt, appointment.salon.timeZone, "yyyy-MM-dd");
    const appointmentTime = formatInTimeZone(appointment.startsAt, appointment.salon.timeZone, "HH:mm");

    const metadata: Record<string, string> = {
      appointment_id: appointment.id,
      salon_id: salon.id,
      payment_kind: PaymentKind.REMAINING_BALANCE,
      remaining_balance_cents: String(remainingAmount),
      total_price_cents: String(totalPrice),
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      salon_slug: appointment.salon.slug,
    };

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "aud",
                unit_amount: remainingAmount,
                product_data: {
                  name: `Remaining balance for ${appointment.salon.name}`,
                  description: appointment.client.firstName
                    ? `Client: ${appointment.client.firstName}${appointment.client.lastName ? ` ${appointment.client.lastName}` : ""}`
                    : undefined,
                },
              },
            },
          ],
          client_reference_id: appointment.id,
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: appointment.client.email ?? undefined,
          metadata,
          payment_intent_data: {
            metadata,
            application_fee_amount: platformFeeForCharge > 0 ? platformFeeForCharge : undefined,
          },
        },
        {
          stripeAccount: appointment.salon.stripeAccountId,
        },
      );

      const existingPendingPayment = appointment.payments.find(
        (payment) => payment.status === PaymentStatus.PENDING && payment.kind === PaymentKind.REMAINING_BALANCE,
      );

      if (existingPendingPayment) {
        await prisma.payment.update({
          where: { id: existingPendingPayment.id },
          data: {
            amountCents: remainingAmount,
            currency: "AUD",
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.PENDING,
            stripeSessionId: session.id,
            stripePaymentIntentId: null,
            stripeChargeId: null,
            platformFeeAmount: platformFeeForCharge,
            connectedAccountId: appointment.salon.stripeAccountId,
          },
        });
      } else {
        await prisma.payment.create({
          data: {
            appointmentId: appointment.id,
            amountCents: remainingAmount,
            currency: "AUD",
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.PENDING,
            stripeSessionId: session.id,
            stripePaymentIntentId: null,
            stripeChargeId: null,
            platformFeeAmount: platformFeeForCharge,
            connectedAccountId: appointment.salon.stripeAccountId,
            kind: PaymentKind.REMAINING_BALANCE,
          },
        });
      }

      revalidatePath("/appointments");
      revalidatePath("/payments");

      return {
        success: true,
        paymentLinkUrl: session.url ?? undefined,
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        return {
          success: false,
          error: error.message || "Stripe could not create a payment link.",
        };
      }

      throw error;
    }
  } catch (error) {
    console.error("Failed to charge remaining balance:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((issue) => issue.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to charge the remaining balance.",
    };
  }
}
