"use server";

import Stripe from "stripe";

import prisma from "@/db";
import { finalizeBookingCheckoutSession } from "@/app/actions/stripe-checkout";
import { syncAccountStatus } from "@/lib/services/stripe-connect-service";
import { AppointmentStatus, PaymentStatus } from "@prisma/client";

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const salonSlug = session.metadata?.salon_slug ?? session.metadata?.salonSlug;

  if (!salonSlug) {
    console.warn(
      "Stripe webhook: checkout.session.completed missing salon slug metadata",
      session.id
    );
    return;
  }

  try {
    const result = await finalizeBookingCheckoutSession(session.id, salonSlug);

    if (!result.success) {
      console.error(
        "Stripe webhook: finalizeBookingCheckoutSession failed",
        session.id,
        result.error
      );
    }
  } catch (error) {
    console.error(
      "Stripe webhook: error processing checkout.session.completed",
      session.id,
      error
    );
  }
}

export async function handleAccountUpdated(
  account: Stripe.Account
): Promise<void> {
  if (!account.id) {
    return;
  }

  const salon = await prisma.salon.findFirst({
    where: { stripeAccountId: account.id },
    select: { id: true },
  });

  if (!salon) {
    return;
  }

  try {
    await syncAccountStatus(salon.id);
  } catch (error) {
    console.error("Stripe webhook: failed to sync account status", account.id, error);
  }
}

export async function handleChargeRefunded(
  charge: Stripe.Charge
): Promise<void> {
  const chargeId = charge.id;

  const orConditions: Array<{ stripeChargeId: string } | { stripePaymentIntentId: string }> = [];

  if (chargeId) {
    orConditions.push({ stripeChargeId: chargeId });
  }

  if (charge.payment_intent) {
    orConditions.push({ stripePaymentIntentId: String(charge.payment_intent) });
  }

  const payment = await prisma.payment.findFirst({
    where: orConditions.length
      ? {
          OR: orConditions,
        }
      : undefined,
    include: {
      appointment: true,
    },
  });

  if (!payment) {
    return;
  }

  const refund = charge.refunds?.data?.[0];
  const refundedAt = refund?.created ? new Date(refund.created * 1000) : new Date();

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        stripeRefundId: refund?.id ?? payment.stripeRefundId,
        refundedAt,
      },
    }),
    prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: {
        status: AppointmentStatus.CANCELED,
      },
    }),
  ]);
}
