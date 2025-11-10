import { NextResponse } from "next/server";
import Stripe from "stripe";

import { finalizeBookingCheckoutSession } from "@/app/actions/stripe-checkout";
import { getStripeServerClient } from "@/lib/stripe";

function decodeSalonSlug(session: Stripe.Checkout.Session): string | null {
  const payload =
    session.metadata?.booking_payload ??
    (typeof session.payment_intent !== "string"
      ? (session.payment_intent as Stripe.PaymentIntent | null)?.metadata?.booking_payload
      : undefined) ??
    null;

  if (!payload) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64").toString("utf-8");
    const data = JSON.parse(json) as { salonSlug?: string };
    return typeof data.salonSlug === "string" ? data.salonSlug : null;
  } catch (error) {
    console.error("Failed to decode salon slug from Stripe metadata", error);
    return null;
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not defined.");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeServerClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const salonSlug = decodeSalonSlug(session);

      if (salonSlug) {
        await finalizeBookingCheckoutSession(session.id, salonSlug);
      } else {
        console.warn("Stripe webhook received session without salon slug metadata", session.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
