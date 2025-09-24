import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getUserSalon } from "@/lib/user-utils";
import prisma from "@/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle error from Stripe
    if (error) {
      const errorDescription = searchParams.get("error_description");
      console.error("Stripe Connect error:", error, errorDescription);
      
      return NextResponse.redirect(
        new URL(`/owner/settings?stripe_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/owner/settings?stripe_error=missing_code", request.url)
      );
    }

    // Get the session to verify the user
    const session = await requireOwnerAuth();
    const salon = await getUserSalon(session.user.id, "OWNER");
    
    if (!salon) {
      return NextResponse.redirect(
        new URL("/owner/settings?stripe_error=salon_not_found", request.url)
      );
    }

    // Exchange the authorization code for account information
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const stripeAccountId = response.stripe_user_id;

    if (!stripeAccountId) {
      return NextResponse.redirect(
        new URL("/owner/settings?stripe_error=invalid_account", request.url)
      );
    }

    // Update the salon with the Stripe account ID
    await prisma.salon.update({
      where: { id: salon.id },
      data: {
        stripeAccountId,
      },
    });

    // Verify the account is properly set up
    try {
      const account = await stripe.accounts.retrieve(stripeAccountId);
      const connected = account.charges_enabled && account.payouts_enabled;
      
      return NextResponse.redirect(
        new URL(
          `/owner/settings?stripe_success=${connected ? "connected" : "pending"}`,
          request.url
        )
      );
    } catch (accountError) {
      console.error("Error verifying Stripe account:", accountError);
      return NextResponse.redirect(
        new URL("/owner/settings?stripe_success=connected", request.url)
      );
    }

  } catch (error) {
    console.error("Stripe Connect callback error:", error);
    return NextResponse.redirect(
      new URL("/owner/settings?stripe_error=callback_failed", request.url)
    );
  }
}