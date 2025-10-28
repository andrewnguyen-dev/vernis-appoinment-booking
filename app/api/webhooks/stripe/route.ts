import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeServerClient } from "@/lib/stripe";
import {
  handleAccountUpdated,
  handleChargeRefunded,
  handleCheckoutSessionCompleted,
} from "@/lib/services/stripe-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable");
  }

  return secret;
}

function buildStripeEvent(rawBody: Buffer, signature: string, secret: string): Stripe.Event {
  const stripe = getStripeServerClient();

  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

async function dispatchEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, event.account);
      break;
    }
    case "account.updated": {
      await handleAccountUpdated(event.data.object as Stripe.Account);
      break;
    }
    case "charge.refunded": {
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;
    }
    default: {
      // Ignore other events for now.
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;

  try {
    event = buildStripeEvent(rawBody, signature, getWebhookSecret());
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await dispatchEvent(event);
  } catch (error) {
    console.error("Error handling Stripe webhook event", event.id, event.type, error);
    return NextResponse.json({ received: true }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
