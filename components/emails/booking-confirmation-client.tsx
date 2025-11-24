import * as React from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Tailwind } from "@react-email/components";

interface ServiceSummary {
  name: string;
  duration: string;
  price: string;
}

interface BookingConfirmationClientEmailProps {
  salonName: string;
  clientName: string;
  appointmentDate: string;
  appointmentTime: string;
  timezoneLabel: string;
  services: ServiceSummary[];
  totalPrice: string;
  amountPaid: string;
  amountDue?: string | null;
  notes?: string | null;
  bookingReference: string;
  confirmationUrl?: string;
  contactEmail?: string | null;
}

const BookingConfirmationClientEmail = (props: BookingConfirmationClientEmailProps) => {
  const {
    salonName,
    clientName,
    appointmentDate,
    appointmentTime,
    timezoneLabel,
    services,
    totalPrice,
    amountPaid,
    amountDue,
    notes,
    bookingReference,
    confirmationUrl,
    contactEmail,
  } = props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>{`You're booked at ${salonName} on ${appointmentDate}`}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-[600px] mx-auto p-[40px]">
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[8px]">Booking Placed</Heading>
              <Text className="text-[16px] text-gray-600 m-0">Thanks for booking with {salonName}</Text>
            </Section>

            <Section className="mb-[24px]">
              <Text className="text-[16px] text-gray-700 leading-[24px] m-0 mb-[16px]">Hi {clientName || "there"},</Text>
              <Text className="text-[16px] text-gray-700 leading-[24px] m-0">
                Your appointment has been placed. All of the details are below so you can easily review your booking anytime.
              </Text>
            </Section>

            <Section className="bg-gray-50 p-[24px] rounded-[12px] mb-[32px]">
              <Text className="text-[14px] font-semibold text-gray-900 uppercase tracking-wide m-0 mb-[12px]">Appointment Details</Text>
              <Text className="text-[16px] text-gray-900 font-semibold m-0">{appointmentDate}</Text>
              <Text className="text-[16px] text-gray-900 font-semibold m-0 mb-[16px]">
                {appointmentTime} <span className="text-gray-500 font-normal">({timezoneLabel})</span>
              </Text>

              <Text className="text-[14px] text-gray-600 m-0 mb-[12px]">Services</Text>
              <Section className="m-0">
                {services.map((service, index) => (
                  <div key={`${service.name}-${index}`} className="flex justify-between text-[14px] text-gray-700 mb-[8px]">
                    <span className="font-medium text-gray-900 mr-2">{service.name}</span>
                    <span className="text-gray-600">
                      {service.duration} &middot; {service.price}
                    </span>
                  </div>
                ))}
              </Section>

              <Hr className="border-gray-200 my-[16px]" />

              <div className="flex justify-between text-[14px] text-gray-700 mb-[4px]">
                <span className="mr-2">Amount paid today</span>
                <span className="font-semibold text-gray-900">{amountPaid}</span>
              </div>
              {amountDue ? (
                <div className="flex justify-between text-[14px] text-gray-700">
                  <span className="mr-2">Balance due at the salon</span>
                  <span className="font-semibold text-gray-900">{amountDue}</span>
                </div>
              ) : null}

              <div className="flex gap-2 justify-between text-[15px] font-semibold text-gray-900 mt-[12px]">
                <span className="mr-2">Total value</span>
                <span>{totalPrice}</span>
              </div>
            </Section>

            {notes ? (
              <Section className="mb-[32px]">
                <Text className="text-[14px] font-semibold text-gray-900 m-0 mb-[8px]">Notes you shared</Text>
                <Text className="text-[14px] text-gray-700 leading-[22px] m-0">{notes}</Text>
              </Section>
            ) : null}

            {confirmationUrl ? (
              <Section className="text-center mb-[32px]">
                <Button
                  href={confirmationUrl}
                  className="bg-blue-600 text-white px-[32px] py-[16px] rounded-[8px] text-[16px] font-semibold no-underline inline-block"
                >
                  View Booking Details
                </Button>
              </Section>
            ) : null}

            <Section className="mb-[24px]">
              <Text className="text-[14px] text-gray-600 leading-[22px] m-0">
                Booking reference: <span className="font-mono text-[13px]">{bookingReference}</span>
              </Text>
              {contactEmail ? (
                <Text className="text-[14px] text-gray-600 leading-[22px] m-0">
                  Need to make a change? Reach out to {salonName} at{" "}
                  <a href={`mailto:${contactEmail}`} className="text-blue-600">
                    {contactEmail}
                  </a>
                  .
                </Text>
              ) : null}
            </Section>

            <Section className="border-t border-gray-200 pt-[24px]">
              <Text className="text-[12px] text-gray-500 leading-[18px] m-0">
                You received this email because you booked an appointment with {salonName}.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default BookingConfirmationClientEmail;
