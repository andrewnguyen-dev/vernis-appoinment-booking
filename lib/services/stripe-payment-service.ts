"use server";

import { AppointmentStatus, PaymentProvider, PaymentStatus } from "@prisma/client";
import Stripe from "stripe";

import prisma from "@/db";
import { getStripeServerClient } from "@/lib/stripe";
import { isAccountReadyForPayments } from "@/lib/services/stripe-connect-service";
import { ensureAbsoluteStripeUrl, resolveStripePlatformBaseUrl } from "@/lib/services/stripe-utils";

export interface CheckoutSessionResult {
  sessionId: string;
  paymentId: string;
  url: string | null;
  amountCents: number;
  currency: string;
}

export interface PaymentProcessingResult {
  paymentId: string;
  status: PaymentStatus;
  amountCents: number;
  stripeFeeAmount: number | null;
  platformFeeAmount: number | null;
  netAmount: number | null;
  capturedAt: Date | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
}

export interface PaymentRefundResult {
  paymentId: string;
  refundId: string;
  status: PaymentStatus;
  refundedAt: Date;
}

interface CreateCheckoutSessionOptions {
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  customerEmail?: string | null;
  locale?: Stripe.Checkout.SessionCreateParams.Locale;
}

interface SalonWithStripe {
  id: string;
  slug: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeRequirementsDue: string[];
  platformFeePercent: number;
  platformFeeMinCents: number;
}

interface AppointmentForCheckout {
  id: string;
  currency: string;
  items: Array<{
    id: string;
    serviceName: string;
    priceCents: number;
    durationMinutes: number;
  }>;
  client: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  salon: SalonWithStripe;
}

function normalizeMetadata(
  metadata: Record<string, string | number | boolean | null | undefined>
): Record<string, string> {
  return Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = typeof value === "string" ? value : String(value);
    return acc;
  }, {});
}

function getDefaultSuccessUrl(baseUrl: string, salonSlug: string): string {
  return `${baseUrl}/${encodeURIComponent(salonSlug)}/book/checkout-success?session_id={CHECKOUT_SESSION_ID}`;
}

function getDefaultCancelUrl(baseUrl: string, salonSlug: string): string {
  return `${baseUrl}/${encodeURIComponent(salonSlug)}/book?checkout=cancelled`;
}

export function calculatePlatformFee(
  amountCents: number,
  config: { platformFeePercent: number; platformFeeMinCents: number }
): number {
  if (amountCents <= 0) {
    return 0;
  }

  const percentFee = Math.round((amountCents * config.platformFeePercent) / 100);
  const fee = Math.max(percentFee, config.platformFeeMinCents);
  return Math.min(fee, amountCents);
}

async function getAppointmentForCheckout(
  appointmentId: string,
  salonSlug: string
): Promise<AppointmentForCheckout> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, salon: { slug: salonSlug } },
    select: {
      id: true,
      salon: {
        select: {
          id: true,
          slug: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          stripeRequirementsDue: true,
          platformFeePercent: true,
          platformFeeMinCents: true,
        },
      },
      items: {
        select: {
          id: true,
          serviceName: true,
          priceCents: true,
          durationMinutes: true,
        },
      },
      client: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!appointment) {
    throw new Error("Appointment not found for the provided salon.");
  }

  return {
    id: appointment.id,
    items: appointment.items,
    client: appointment.client,
    salon: appointment.salon,
    currency: "aud",
  };
}

async function upsertStripePaymentRecord(
  appointment: AppointmentForCheckout,
  session: Stripe.Checkout.Session,
  platformFeeAmount: number,
  amountCents: number
) {
  const existingPayment = await prisma.payment.findFirst({
    where: {
      appointmentId: appointment.id,
      provider: PaymentProvider.STRIPE,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        amountCents,
        currency: appointment.currency.toUpperCase(),
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        providerRef: null,
        capturedAt: null,
        refundedAt: null,
        stripeSessionId: session.id,
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeFeeAmount: null,
        platformFeeAmount,
        netAmount: null,
        stripeRefundId: null,
        connectedAccountId: appointment.salon.stripeAccountId,
      },
    });

    return existingPayment.id;
  }

  const payment = await prisma.payment.create({
    data: {
      appointmentId: appointment.id,
      amountCents,
      currency: appointment.currency.toUpperCase(),
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.PENDING,
      providerRef: null,
      stripeSessionId: session.id,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeFeeAmount: null,
      platformFeeAmount,
      netAmount: null,
      stripeRefundId: null,
      connectedAccountId: appointment.salon.stripeAccountId,
    },
  });

  return payment.id;
}

export async function createAppointmentCheckoutSession(
  appointmentId: string,
  salonSlug: string,
  options: CreateCheckoutSessionOptions = {}
): Promise<CheckoutSessionResult> {
  const appointment = await getAppointmentForCheckout(appointmentId, salonSlug);

  if (!appointment.items.length) {
    throw new Error("Cannot create a checkout session without appointment items.");
  }

  if (!appointment.salon.stripeAccountId) {
    throw new Error("Salon has not completed Stripe Connect onboarding.");
  }

  const cachedReady =
    appointment.salon.stripeChargesEnabled &&
    appointment.salon.stripePayoutsEnabled &&
    (appointment.salon.stripeRequirementsDue?.length ?? 0) === 0;

  if (!cachedReady && !(await isAccountReadyForPayments(appointment.salon.id))) {
    throw new Error("Salon is not ready to accept payments. Complete Stripe onboarding first.");
  }

  const amountCents = appointment.items.reduce((sum, item) => sum + item.priceCents, 0);
  const platformFeeAmount = calculatePlatformFee(amountCents, {
    platformFeePercent: appointment.salon.platformFeePercent,
    platformFeeMinCents: appointment.salon.platformFeeMinCents,
  });

  const stripe = getStripeServerClient();
  const baseUrl = resolveStripePlatformBaseUrl();
  const successUrl = options.successUrl
    ? ensureAbsoluteStripeUrl(options.successUrl, baseUrl)
    : getDefaultSuccessUrl(baseUrl, appointment.salon.slug);
  const cancelUrl = options.cancelUrl
    ? ensureAbsoluteStripeUrl(options.cancelUrl, baseUrl)
    : getDefaultCancelUrl(baseUrl, appointment.salon.slug);

  const metadata = normalizeMetadata({
    appointmentId: appointment.id,
    salonId: appointment.salon.id,
    salonSlug: appointment.salon.slug,
    ...options.metadata,
  });

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: appointment.items.map((item) => ({
        quantity: 1,
        price_data: {
          currency: appointment.currency,
          unit_amount: item.priceCents,
          product_data: {
            name: item.serviceName,
          },
        },
      })),
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        metadata,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      client_reference_id: appointment.id,
      customer_email: options.customerEmail ?? appointment.client?.email ?? undefined,
      locale: options.locale,
    },
    {
      stripeAccount: appointment.salon.stripeAccountId,
    }
  );

  const paymentId = await upsertStripePaymentRecord(appointment, session, platformFeeAmount, amountCents);

  return {
    sessionId: session.id,
    paymentId,
    url: session.url ?? null,
    amountCents,
    currency: appointment.currency.toUpperCase(),
  };
}

export async function handleSuccessfulPayment(sessionId: string): Promise<PaymentProcessingResult> {
  const payment = await prisma.payment.findFirst({
    where: { stripeSessionId: sessionId },
    include: {
      appointment: {
        include: {
          salon: {
            select: {
              id: true,
              stripeAccountId: true,
            },
          },
        },
      },
    },
  });

  if (!payment || !payment.appointment) {
    throw new Error("Payment record not found for the supplied session id.");
  }

  const stripeAccountId = payment.connectedAccountId ?? payment.appointment.salon.stripeAccountId;

  if (!stripeAccountId) {
    throw new Error("Connected account information is missing for this payment.");
  }

  const stripe = getStripeServerClient();

  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {
      expand: ["payment_intent"],
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error("Stripe did not return a payment intent for the completed session.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    {
      expand: ["charges.data.balance_transaction"],
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  const charge = paymentIntent.charges.data[0];

  if (!charge) {
    throw new Error("No charge was found for the supplied payment intent.");
  }

  const balanceTx = charge.balance_transaction;
  let stripeFeeAmount: number | null = null;
  let netAmount: number | null = null;

  if (balanceTx && typeof balanceTx !== "string") {
    stripeFeeAmount = balanceTx.fee ?? null;
    netAmount = balanceTx.net ?? null;
  } else if (typeof balanceTx === "string") {
    const balanceTransaction = await stripe.balanceTransactions.retrieve(
      balanceTx,
      {},
      {
        stripeAccount: stripeAccountId,
      }
    );
    stripeFeeAmount = balanceTransaction.fee ?? null;
    netAmount = balanceTransaction.net ?? null;
  }

  const platformFeeAmount =
    charge.application_fee_amount ?? paymentIntent.application_fee_amount ?? payment.platformFeeAmount ?? null;

  let statusUpdate: PaymentStatus = PaymentStatus.PAID;

  if (paymentIntent.status === "requires_capture" || paymentIntent.status === "processing") {
    statusUpdate = PaymentStatus.AUTHORIZED;
  } else if (
    paymentIntent.status === "requires_payment_method" ||
    paymentIntent.status === "requires_confirmation" ||
    paymentIntent.status === "canceled"
  ) {
    statusUpdate = PaymentStatus.FAILED;
  }

  const capturedAt =
    statusUpdate === PaymentStatus.PAID && charge.created ? new Date(charge.created * 1000) : null;

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: statusUpdate,
      providerRef: paymentIntent.id,
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: charge.id,
      stripeFeeAmount,
      platformFeeAmount,
      netAmount,
      capturedAt,
      connectedAccountId: stripeAccountId,
    },
  });

  return {
    paymentId: updatedPayment.id,
    status: updatedPayment.status,
    amountCents: updatedPayment.amountCents,
    stripeFeeAmount,
    platformFeeAmount,
    netAmount,
    capturedAt,
    stripePaymentIntentId: updatedPayment.stripePaymentIntentId,
    stripeChargeId: updatedPayment.stripeChargeId,
  };
}

export async function refundAppointment(
  appointmentId: string,
  reason?: Stripe.RefundCreateParams.Reason
): Promise<PaymentRefundResult> {
  const payment = await prisma.payment.findFirst({
    where: {
      appointmentId,
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.PAID,
    },
    include: {
      appointment: {
        include: {
          salon: {
            select: {
              id: true,
              stripeAccountId: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new Error("No paid Stripe payment found for this appointment.");
  }

  const stripeAccountId = payment.connectedAccountId ?? payment.appointment?.salon.stripeAccountId;

  if (!stripeAccountId) {
    throw new Error("Connected account is missing for this payment.");
  }

  const stripe = getStripeServerClient();

  const refundParams: Stripe.RefundCreateParams = {
    reason,
    metadata: {
      appointmentId,
      paymentId: payment.id,
    },
  };

  if (payment.stripeChargeId) {
    refundParams.charge = payment.stripeChargeId;
  } else if (payment.stripePaymentIntentId) {
    refundParams.payment_intent = payment.stripePaymentIntentId;
  } else {
    throw new Error("Payment is missing charge and payment intent references; cannot process refund.");
  }

  const refund = await stripe.refunds.create(refundParams, {
    stripeAccount: stripeAccountId,
  });

  const refundedAt = refund.created ? new Date(refund.created * 1000) : new Date();

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt,
        stripeRefundId: refund.id,
      },
    }),
    prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELED,
      },
    }),
  ]);

  return {
    paymentId: payment.id,
    refundId: refund.id,
    status: PaymentStatus.REFUNDED,
    refundedAt,
  };
}
