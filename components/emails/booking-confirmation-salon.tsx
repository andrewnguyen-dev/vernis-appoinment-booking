import * as React from "react";
import {
  Body,
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

interface BookingConfirmationSalonEmailProps {
  salonName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  timezoneLabel: string;
  services: ServiceSummary[];
  totalPrice: string;
  amountPaid: string;
  amountDue?: string | null;
  notes?: string | null;
  bookingReference: string;
}

const BookingConfirmationSalonEmail = (props: BookingConfirmationSalonEmailProps) => {
  const {
    salonName,
    clientName,
    clientEmail,
    clientPhone,
    appointmentDate,
    appointmentTime,
    timezoneLabel,
    services,
    totalPrice,
    amountPaid,
    amountDue,
    notes,
    bookingReference,
  } = props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>{`New booking from ${clientName} on ${appointmentDate}`}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-[600px] mx-auto p-[40px]">
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[8px]">
                New Booking Received
              </Heading>
              <Text className="text-[16px] text-gray-600 m-0">
                {salonName} has a new appointment to review
              </Text>
            </Section>

            <Section className="mb-[24px]">
              <Text className="text-[16px] text-gray-700 leading-[24px] m-0">
                Client <strong>{clientName}</strong> just secured a booking. Here are the
                full details so your team can prepare.
              </Text>
            </Section>

            <Section className="bg-gray-50 p-[24px] rounded-[12px] mb-[32px]">
              <Text className="text-[14px] font-semibold text-gray-900 uppercase tracking-wide m-0 mb-[12px]">
                Appointment Details
              </Text>
              <Text className="text-[16px] text-gray-900 font-semibold m-0">
                {appointmentDate}
              </Text>
              <Text className="text-[16px] text-gray-900 font-semibold m-0 mb-[16px]">
                {appointmentTime} ({timezoneLabel})
              </Text>

              <Text className="text-[14px] text-gray-600 m-0 mb-[12px]">
                Services
              </Text>
              {services.map((service, index) => (
                <div key={`${service.name}-${index}`} className="flex justify-between text-[14px] text-gray-700 mb-[8px]">
                  <span className="font-medium text-gray-900 mr-2">{service.name}</span>
                  <span className="text-gray-600">
                    {service.duration} &middot; {service.price}
                  </span>
                </div>
              ))}

              <Hr className="border-gray-200 my-[16px]" />

              <div className="flex justify-between text-[14px] text-gray-700 mb-[4px]">
                <span className="mr-2">Captured today</span>
                <span className="font-semibold text-gray-900">{amountPaid}</span>
              </div>
              {amountDue ? (
                <div className="flex justify-between text-[14px] text-gray-700">
                  <span className="mr-2">Remaining balance</span>
                  <span className="font-semibold text-gray-900">{amountDue}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-[15px] font-semibold text-gray-900 mt-[12px]">
                <span className="mr-2">Total value</span>
                <span>{totalPrice}</span>
              </div>
            </Section>

            <Section className="mb-[24px]">
              <Text className="text-[14px] text-gray-900 font-semibold m-0 mb-[8px]">
                Client Contact
              </Text>
              {clientEmail ? (
                <Text className="text-[14px] text-gray-700 leading-[22px] m-0">
                  Email: {clientEmail}
                </Text>
              ) : null}
              {clientPhone ? (
                <Text className="text-[14px] text-gray-700 leading-[22px] m-0">
                  Phone: {clientPhone}
                </Text>
              ) : null}
              {!clientEmail && !clientPhone ? (
                <Text className="text-[14px] text-gray-700 leading-[22px] m-0">
                  The client did not share contact details.
                </Text>
              ) : null}
            </Section>

            {notes ? (
              <Section className="mb-[24px]">
                <Text className="text-[14px] text-gray-900 font-semibold m-0 mb-[8px]">
                  Client Notes
                </Text>
                <Text className="text-[14px] text-gray-700 leading-[22px] m-0">{notes}</Text>
              </Section>
            ) : null}

            <Section>
              <Text className="text-[14px] text-gray-600 leading-[22px] m-0">
                Booking reference: <span className="font-mono text-[13px]">{bookingReference}</span>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default BookingConfirmationSalonEmail;
