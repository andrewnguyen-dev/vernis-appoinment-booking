import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/db";
import { headers } from "next/headers";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      console.error("No Stripe signature found");
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log("Received Stripe webhook:", event.type, event.id);

    // Handle the event
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(dispute);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle Stripe Connect account updates
 */
async function handleAccountUpdated(account: Stripe.Account) {
  try {
    // Find the salon associated with this Stripe account
    const salon = await prisma.salon.findUnique({
      where: { stripeAccountId: account.id },
    });

    if (!salon) {
      console.error(`No salon found for Stripe account: ${account.id}`);
      return;
    }

    const connected = account.charges_enabled && account.payouts_enabled;
    
    console.log(`Account ${account.id} updated. Connected: ${connected}`);
    
    // Note: We're not storing the status in the database yet, but this is where
    // we would update it when we add the stripeAccountStatus field
  } catch (error) {
    console.error("Error handling account.updated:", error);
  }
}

/**
 * Handle successful payment intents
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const appointmentId = paymentIntent.metadata.appointment_id;
    
    if (!appointmentId) {
      console.error("No appointment_id in payment intent metadata");
      return;
    }

    // Update payment status
    await prisma.payment.updateMany({
      where: { 
        providerRef: paymentIntent.id,
        appointmentId,
      },
      data: { 
        status: "PAID",
        capturedAt: new Date(),
      },
    });

    // Update appointment status if needed
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "BOOKED" },
    });

    console.log(`Payment succeeded for appointment: ${appointmentId}`);
  } catch (error) {
    console.error("Error handling payment_intent.succeeded:", error);
  }
}

/**
 * Handle failed payment intents
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const appointmentId = paymentIntent.metadata.appointment_id;
    
    if (!appointmentId) {
      console.error("No appointment_id in payment intent metadata");
      return;
    }

    // Update payment status
    await prisma.payment.updateMany({
      where: { 
        providerRef: paymentIntent.id,
        appointmentId,
      },
      data: { 
        status: "FAILED",
      },
    });

    // Cancel the appointment since payment failed
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELED" },
    });

    console.log(`Payment failed for appointment: ${appointmentId}`);
  } catch (error) {
    console.error("Error handling payment_intent.payment_failed:", error);
  }
}

/**
 * Handle dispute creation
 */
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  try {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
    
    console.log(`Dispute created for charge: ${chargeId}`);
    
    // We could potentially find the payment by looking up the PaymentIntent
    // associated with this charge, but for now just log the event
    console.log(`Dispute reason: ${dispute.reason}`);
    console.log(`Dispute amount: ${dispute.amount}`);
    
    // Here you could send notifications to salon owners about the dispute
  } catch (error) {
    console.error("Error handling charge.dispute.created:", error);
  }
}