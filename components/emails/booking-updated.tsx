import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

interface ServiceSummary {
  name: string;
  duration: string;
  price: string;
}

interface BookingUpdatedEmailProps {
  salonName: string;
  clientName: string;
  appointmentDate: string;
  appointmentTime: string;
  timezoneLabel: string;
  changeSummary: string;
  services: ServiceSummary[];
  totalPrice: string;
  amountPaid?: string | null;
  amountDue?: string | null;
  notes?: string | null;
  bookingReference: string;
  viewDetailsUrl?: string;
}

const BookingUpdatedEmail = (props: BookingUpdatedEmailProps) => {
  const {
    salonName,
    clientName,
    appointmentDate,
    appointmentTime,
    timezoneLabel,
    changeSummary,
    services,
    totalPrice,
    amountPaid,
    amountDue,
    notes,
    bookingReference,
    viewDetailsUrl,
  } = props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Your booking has been updated at {salonName}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[10px] shadow-sm max-w-[600px] mx-auto p-[40px]">
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[8px]">
                Your booking has been updated
              </Heading>
            </Section>

            <Section className="mb-[24px]">
              <Text className="text-[16px] text-gray-700 leading-[24px] m-0 mb-[8px]">
                Hi {clientName || "there"},
              </Text>
              <Text className="text-[16px] text-gray-700 leading-[24px] m-0">
                {changeSummary}
              </Text>
            </Section>

            <Section className="bg-gray-50 p-[24px] rounded-[12px] mb-[32px]">
              <Text className="text-[14px] font-semibold text-gray-900 uppercase tracking-wide m-0 mb-[12px]">
                Updated appointment
              </Text>
              <Text className="text-[16px] text-gray-900 font-semibold m-0">
                {appointmentDate}
              </Text>
              <Text className="text-[16px] text-gray-900 font-semibold m-0 mb-[16px]">
                {appointmentTime} <span className="text-gray-500 font-normal">({timezoneLabel})</span>
              </Text>

              <Text className="text-[14px] text-gray-600 m-0 mb-[10px]">Services</Text>
              {services.map((service, index) => (
                <div key={`${service.name}-${index}`} className="flex justify-between text-[14px] text-gray-700 mb-[8px]">
                  <span className="font-medium text-gray-900 mr-2">{service.name}</span>
                  <span className="text-gray-600">
                    {service.duration} &middot; {service.price}
                  </span>
                </div>
              ))}

              <Hr className="border-gray-200 my-[16px]" />

              <div className="flex justify-between text-[14px] text-gray-700">
                <span className="mr-2">Total value</span>
                <span className="font-semibold text-gray-900">{totalPrice}</span>
              </div>

              {amountPaid ? (
                <div className="flex justify-between text-[14px] text-gray-700 mt-[4px]">
                  <span className="mr-2">Paid so far</span>
                  <span className="font-semibold text-gray-900">{amountPaid}</span>
                </div>
              ) : null}

              {amountDue ? (
                <div className="flex justify-between text-[14px] text-gray-700 mt-[4px]">
                  <span className="mr-2">Balance remaining</span>
                  <span className="font-semibold text-gray-900">{amountDue}</span>
                </div>
              ) : null}
            </Section>

            {notes ? (
              <Section className="mb-[24px]">
                <Text className="text-[14px] text-gray-900 font-semibold m-0 mb-[8px]">
                  Notes from {salonName}
                </Text>
                <Text className="text-[14px] text-gray-700 leading-[22px] m-0">{notes}</Text>
              </Section>
            ) : null}

            {viewDetailsUrl ? (
              <Section className="text-center mb-[24px]">
                <Button
                  href={viewDetailsUrl}
                  className="bg-blue-600 text-white px-[32px] py-[16px] rounded-[8px] text-[16px] font-semibold no-underline inline-block"
                >
                  View Updated Booking
                </Button>
              </Section>
            ) : null}

            <Section className="mb-[16px]">
              <Text className="text-[14px] text-gray-600 leading-[22px] m-0">
                Booking reference: <span className="font-mono text-[13px]">{bookingReference}</span>
              </Text>
            </Section>

            <Section className="border-t border-gray-200 pt-[24px]">
              <Text className="text-[12px] text-gray-500 leading-[18px] m-0">
                You are receiving this email because your {salonName} booking was updated.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default BookingUpdatedEmail;
