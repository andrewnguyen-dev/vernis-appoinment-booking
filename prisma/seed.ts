// 10 Sep 2025 //

import { PrismaClient, AppointmentStatus, PaymentProvider, PaymentStatus, DayOfWeek } from '@prisma/client';

const prisma = new PrismaClient();

// Simple slug helper
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Build a Date in Australia/Sydney (+10:00 standard; +11:00 DST) using an ISO string.
// Pass e.g. '2025-09-15T10:00:00+10:00'
const at = (iso: string) => new Date(iso);

// Add minutes to a Date
const addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60 * 1000);

async function createSalonBundle({
  ownerId,
  name,
  slug,
  timeZone = 'Australia/Sydney',
  customDomain,
  logoUrl,
  capacity = 4,
}: {
  ownerId: string;
  name: string;
  slug?: string;
  timeZone?: string;
  customDomain?: string | null;
  logoUrl?: string | null;
  capacity?: number | null;
}) {
  const salon = await prisma.salon.create({
    data: {
      name,
      slug: slug || slugify(name),
      timeZone,
      customDomain: customDomain ?? null,
      logoUrl: logoUrl ?? null,
      capacity,
      ownerId, // Direct ownership relationship
    },
  });

  // Add default business hours
  const businessHours = [
    { dayOfWeek: DayOfWeek.MONDAY, openTime: "09:00", closeTime: "17:00", isClosed: false },
    { dayOfWeek: DayOfWeek.TUESDAY, openTime: "09:00", closeTime: "17:00", isClosed: false },
    { dayOfWeek: DayOfWeek.WEDNESDAY, openTime: "09:00", closeTime: "17:00", isClosed: false },
    { dayOfWeek: DayOfWeek.THURSDAY, openTime: "09:00", closeTime: "17:00", isClosed: false },
    { dayOfWeek: DayOfWeek.FRIDAY, openTime: "09:00", closeTime: "17:00", isClosed: false },
    { dayOfWeek: DayOfWeek.SATURDAY, openTime: "09:00", closeTime: "15:00", isClosed: false },
    { dayOfWeek: DayOfWeek.SUNDAY, openTime: "10:00", closeTime: "16:00", isClosed: true },
  ];

  await prisma.$transaction(
    businessHours.map(hours =>
      prisma.businessHours.create({
        data: {
          salonId: salon.id,
          ...hours,
        },
      })
    )
  );

  // Categories
  const hair = await prisma.serviceCategory.create({
    data: { salonId: salon.id, name: 'Hair', order: 1 },
  });
  const nails = await prisma.serviceCategory.create({
    data: { salonId: salon.id, name: 'Nails', order: 2 },
  });

  // Services
  const services = await prisma.$transaction([
    prisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: hair.id,
        name: 'Women Haircut',
        durationMinutes: 60,
        priceCents: 9500,
        active: true,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: hair.id,
        name: 'Men Haircut',
        durationMinutes: 45,
        priceCents: 6500,
        active: true,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: hair.id,
        name: 'Colour + Blow Dry',
        durationMinutes: 120,
        priceCents: 18500,
        active: true,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: nails.id,
        name: 'Manicure',
        durationMinutes: 40,
        priceCents: 5500,
        active: true,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: nails.id,
        name: 'Pedicure',
        durationMinutes: 50,
        priceCents: 7500,
        active: true,
      },
    }),
  ]);

  // Clients
  const [alice, bob, charlie] = await prisma.$transaction([
    prisma.client.create({
      data: {
        salonId: salon.id,
        firstName: 'Alice',
        lastName: 'Nguyen',
        email: 'alice@example.com',
        phone: '+61 400 000 111',
        notes: 'Prefers morning appointments.',
      },
    }),
    prisma.client.create({
      data: {
        salonId: salon.id,
        firstName: 'Bob',
        lastName: 'Lee',
        email: 'bob@example.com',
        phone: '+61 400 000 222',
      },
    }),
    prisma.client.create({
      data: {
        salonId: salon.id,
        firstName: 'Charlie',
        lastName: 'Khan',
        email: 'charlie@example.com',
        phone: '+61 400 000 333',
      },
    }),
  ]);

  // Appointments (multi-service with snapshot in items)
  // Example dates use +10:00 (Sydney standard). Adjust as you like.
  const start1 = at('2025-09-15T10:00:00+10:00'); // Mon 15 Sep 2025 10:00
  const appt1Items = [
    services.find(s => s.name === 'Women Haircut')!,
    services.find(s => s.name === 'Manicure')!,
  ];
  const appt1Duration = appt1Items.reduce((acc, s) => acc + s.durationMinutes, 0);
  const end1 = addMinutes(start1, appt1Duration);

  const appt1 = await prisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: alice.id,
      startsAt: start1,
      endsAt: end1,
      status: AppointmentStatus.BOOKED,
      notes: 'First-time package booking.',
      createdByUserId: ownerId,
    },
  });

  await prisma.$transaction(
    appt1Items.map((s, i) =>
      prisma.appointmentItem.create({
        data: {
          appointmentId: appt1.id,
          serviceId: s.id,
          serviceName: s.name, // snapshot
          priceCents: s.priceCents, // snapshot
          durationMinutes: s.durationMinutes, // snapshot
          sortOrder: i,
        },
      })
    )
  );

  // Add a payment for appt1 (partial then captured)
  await prisma.payment.create({
    data: {
      appointmentId: appt1.id,
      amountCents: appt1Items.reduce((acc, s) => acc + s.priceCents, 0),
      provider: PaymentProvider.STRIPE,
      providerRef: 'pi_demo_123',
      status: PaymentStatus.PAID,
      capturedAt: new Date(),
      currency: 'AUD',
    },
  });

  // A single-service future appointment for Bob
  const start2 = at('2025-09-20T14:30:00+10:00');
  const s2 = services.find(s => s.name === 'Men Haircut')!;
  const end2 = addMinutes(start2, s2.durationMinutes);

  const appt2 = await prisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: bob.id,
      startsAt: start2,
      endsAt: end2,
      status: AppointmentStatus.BOOKED,
      notes: 'Walk-in last time; now scheduled.',
      createdByUserId: ownerId,
    },
  });

  await prisma.appointmentItem.create({
    data: {
      appointmentId: appt2.id,
      serviceId: s2.id,
      serviceName: s2.name,
      priceCents: s2.priceCents,
      durationMinutes: s2.durationMinutes,
      sortOrder: 0,
    },
  });

  // Completed appointment in the past for Charlie (no payment yet)
  const start3 = at('2025-08-25T09:00:00+10:00');
  const s3 = services.find(s => s.name === 'Pedicure')!;
  const end3 = addMinutes(start3, s3.durationMinutes);

  const appt3 = await prisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: charlie.id,
      startsAt: start3,
      endsAt: end3,
      status: AppointmentStatus.COMPLETED,
      notes: 'Repeat customer.',
      createdByUserId: ownerId,
    },
  });

  await prisma.appointmentItem.create({
    data: {
      appointmentId: appt3.id,
      serviceId: s3.id,
      serviceName: s3.name,
      priceCents: s3.priceCents,
      durationMinutes: s3.durationMinutes,
      sortOrder: 0,
    },
  });

  return { salon, services, clients: { alice, bob, charlie }, appointments: { appt1, appt2, appt3 } };
}

async function main() {
  console.log('🌱 Seeding start…');

  // Clean tables (safe for dev only). Order matters because of FKs.
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.appointmentItem.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.client.deleteMany(),
    prisma.service.deleteMany(),
    prisma.serviceCategory.deleteMany(),
    prisma.salonClosure.deleteMany(),
    prisma.businessHours.deleteMany(),
    prisma.salon.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.verification.deleteMany(),
  ]);

  // Owner user
  const owner = await prisma.user.create({
    data: {
      name: 'Owner One',
      email: 'owner@example.com',
      emailVerified: true,
      image: null,
      twoFactorEnabled: false,
    },
  });

  // Create one salon for the owner
  const salon = await createSalonBundle({
    ownerId: owner.id,
    name: 'Luxe Lane Salon',
    slug: 'luxe-lane',
    customDomain: 'luxelane.example.com',
    logoUrl: null,
    capacity: 6,
  });

  console.log('✅ Seed complete:', {
    owner: { id: owner.id, email: owner.email },
    salon: salon.salon.slug,
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
