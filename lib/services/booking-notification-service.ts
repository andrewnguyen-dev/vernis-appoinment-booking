import * as React from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

import prisma from "@/db";
import { Role } from "@prisma/client";
import BookingConfirmationClientEmail from "@/components/emails/booking-confirmation-client";
import BookingConfirmationSalonEmail from "@/components/emails/booking-confirmation-salon";
import { formatTimezone } from "@/lib/timezone";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromAddress = process.env.RESEND_FROM_EMAIL ?? "hello@vernis.app";
const defaultBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vernis.app";

function formatCurrency(cents: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

async function getSalonOwnerEmails(salonId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      salonId,
      role: Role.OWNER,
    },
    select: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  return memberships
    .map((membership) => membership.user.email)
    .filter((email): email is string => Boolean(email));
}

interface ServiceSummary {
  name: string;
  durationMinutes: number;
  priceCents: number;
}

interface SendBookingConfirmationEmailsInput {
  appointmentId: string;
  startsAt: Date;
  salon: {
    id: string;
    name: string;
    slug: string;
    timeZone: string;
  };
  client: {
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  services: ServiceSummary[];
  totalPriceCents: number;
  captureAmountCents: number;
  remainingBalanceCents: number;
  notes?: string | null;
}

export async function sendBookingConfirmationEmails(
  payload: SendBookingConfirmationEmailsInput
): Promise<void> {
  if (!resend) {
    console.warn("Resend API key is not configured. Skipping booking confirmation emails.");
    return;
  }

  try {
    const clientFullName = `${payload.client.firstName} ${payload.client.lastName ?? ""}`.trim() || "Valued client";
    const timezoneLabel = formatTimezone(payload.salon.timeZone);
    const appointmentDate = formatInTimeZone(payload.startsAt, payload.salon.timeZone, "EEEE, MMMM d, yyyy");
    const appointmentTime = formatInTimeZone(payload.startsAt, payload.salon.timeZone, "h:mm a");
    const isoDate = formatInTimeZone(payload.startsAt, payload.salon.timeZone, "yyyy-MM-dd");
    const isoTime = formatInTimeZone(payload.startsAt, payload.salon.timeZone, "HH:mm");
    const totalDuration = payload.services.reduce((sum, service) => sum + service.durationMinutes, 0);
    const serviceNames = payload.services.map((service) => service.name).join(", ");
    const serviceSummaries = payload.services.map((service) => ({
      name: service.name,
      duration: `${service.durationMinutes} min`,
      price: formatCurrency(service.priceCents),
    }));

    const totalPrice = formatCurrency(payload.totalPriceCents);
    const amountPaid = formatCurrency(payload.captureAmountCents);
    const amountDue = payload.remainingBalanceCents > 0
      ? formatCurrency(payload.remainingBalanceCents)
      : null;

    const query = new URLSearchParams({
      appointmentId: payload.appointmentId,
      clientName: clientFullName,
      date: isoDate,
      time: isoTime,
      duration: String(totalDuration),
      total: String(payload.totalPriceCents),
    });

    if (serviceNames) {
      query.set("services", serviceNames);
    }

    const confirmationUrl = `${defaultBaseUrl.replace(/\/$/, "")}/${payload.salon.slug}/book/confirmation?${query.toString()}`;

    const ownerEmails = await getSalonOwnerEmails(payload.salon.id);
    const contactEmail = ownerEmails[0] ?? null;

    const sendOperations: Promise<unknown>[] = [];

    if (payload.client.email) {
      const clientHtml = await render(
        React.createElement(BookingConfirmationClientEmail, {
          salonName: payload.salon.name,
          clientName: clientFullName,
          appointmentDate,
          appointmentTime,
          timezoneLabel,
          services: serviceSummaries,
          totalPrice,
          amountPaid,
          amountDue,
          notes: payload.notes,
          bookingReference: payload.appointmentId,
          confirmationUrl,
          contactEmail,
        })
      );

      sendOperations.push(
        resend.emails.send({
          from: fromAddress,
          to: payload.client.email,
          subject: `You're booked at ${payload.salon.name}`,
          html: clientHtml,
        })
      );
    }

    if (ownerEmails.length) {
      const salonHtml = await render(
        React.createElement(BookingConfirmationSalonEmail, {
          salonName: payload.salon.name,
          clientName: clientFullName,
          clientEmail: payload.client.email,
          clientPhone: payload.client.phone,
          appointmentDate,
          appointmentTime,
          timezoneLabel,
          services: serviceSummaries,
          totalPrice,
          amountPaid,
          amountDue,
          notes: payload.notes,
          bookingReference: payload.appointmentId,
        })
      );

      sendOperations.push(
        resend.emails.send({
          from: fromAddress,
          to: ownerEmails,
          subject: `New booking from ${clientFullName}`,
          html: salonHtml,
        })
      );
    }

    if (sendOperations.length) {
      const results = await Promise.allSettled(sendOperations);
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Failed to send booking confirmation email", result.reason);
        }
      });
    }
  } catch (error) {
    console.error("Error preparing booking confirmation emails", error);
  }
}
