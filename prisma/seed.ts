// 10 Sep 2025 //

import { PrismaClient, AppointmentStatus, PaymentProvider, PaymentStatus, Role, DayOfWeek } from '@prisma/client';

const prisma = new PrismaClient();

// Simple slug helper
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Build a Date in Australia/Sydney (+10:00 standard; +11:00 DST) using an ISO string.
// Pass e.g. '2025-09-15T10:00:00+10:00'
const at = (iso: string) => new Date(iso);

// Add minutes to a Date
const addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60 * 1000);

type StripeSeedConfig = {
  stripeAccountId?: string | null;
  stripeAccountStatus?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeOnboardedAt?: Date | string | null;
  stripeRequirementsDue?: string[];
  platformFeePercent?: number;
  platformFeeMinCents?: number;
};

async function createSalonBundle({
  ownerId,
  name,
  slug,
  timeZone = 'Australia/Sydney',
  customDomain,
  logoUrl,
  capacity = 4,
  stripe,
}: {
  ownerId: string;
  name: string;
  slug?: string;
  timeZone?: string;
  customDomain?: string | null;
  logoUrl?: string | null;
  capacity?: number | null;
  stripe?: StripeSeedConfig;
}) {
  const resolvedSlug = slug || slugify(name);
  const slugToken = resolvedSlug.replace(/[^a-z0-9]/g, '');

  const salon = await prisma.salon.create({
    data: {
      name,
      slug: resolvedSlug,
      timeZone,
      customDomain: customDomain ?? null,
      logoUrl: logoUrl ?? null,
      capacity: capacity ?? 4,
      stripeAccountId: stripe?.stripeAccountId ?? null,
      stripeAccountStatus: stripe?.stripeAccountStatus ?? null,
      stripeChargesEnabled: stripe?.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: stripe?.stripePayoutsEnabled ?? false,
      stripeOnboardedAt: stripe?.stripeOnboardedAt ? new Date(stripe.stripeOnboardedAt) : null,
      stripeRequirementsDue: stripe?.stripeRequirementsDue ?? [],
      platformFeePercent: stripe?.platformFeePercent ?? 10,
      platformFeeMinCents: stripe?.platformFeeMinCents ?? 50,
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

  // OWNER membership
  await prisma.membership.create({
    data: {
      userId: ownerId,
      salonId: salon.id,
      role: Role.OWNER,
    },
  });

  // Create staff profile for the owner
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
  });

  if (owner) {
    await prisma.staff.create({
      data: {
        userId: ownerId,
        salonId: salon.id,
        color: "#3B82F6", // Default blue for owners
        active: true,
        notes: "Salon Owner",
      },
    });
  }

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
  const appt1Total = appt1Items.reduce((acc, s) => acc + s.priceCents, 0);
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
  const connectedAccountId = stripe?.stripeAccountId ?? null;
  const platformFeePercent = stripe?.platformFeePercent ?? 10;
  const platformFeeMinCents = stripe?.platformFeeMinCents ?? 50;
  const basePlatformFeeAmount = Math.max(Math.round((appt1Total * platformFeePercent) / 100), platformFeeMinCents);
  const useStripePayment = Boolean(connectedAccountId && (stripe?.stripeChargesEnabled ?? false));
  const platformFeeAmount = useStripePayment ? basePlatformFeeAmount : null;
  const stripeFeeAmount = useStripePayment ? Math.round(appt1Total * 0.029) + 30 : null;
  const netAmount = useStripePayment && platformFeeAmount !== null && stripeFeeAmount !== null
    ? Math.max(appt1Total - platformFeeAmount - stripeFeeAmount, 0)
    : null;
  const stripePaymentIntentId = `pi_seed_${slugToken}_001`;
  const stripeSessionId = `cs_seed_${slugToken}_001`;
  const stripeChargeId = `ch_seed_${slugToken}_001`;

  await prisma.payment.create({
    data: {
      appointmentId: appt1.id,
      amountCents: appt1Total,
      provider: useStripePayment ? PaymentProvider.STRIPE : PaymentProvider.CASH,
      providerRef: useStripePayment ? stripePaymentIntentId : null,
      status: PaymentStatus.PAID,
      capturedAt: new Date(),
      currency: 'AUD',
      platformFeeAmount,
      stripeSessionId: useStripePayment ? stripeSessionId : null,
      stripePaymentIntentId: useStripePayment ? stripePaymentIntentId : null,
      stripeChargeId: useStripePayment ? stripeChargeId : null,
      stripeFeeAmount,
      netAmount,
      connectedAccountId: useStripePayment ? connectedAccountId : null,
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
    prisma.membership.deleteMany(),
    prisma.salon.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.verification.deleteMany(),
  ]);

  // Create three separate owners, each owning one salon
  
  // First owner and salon
  const owner1 = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice.owner@example.com',
      emailVerified: true,
      image: null,
      twoFactorEnabled: false,
    },
  });

  const s1 = await createSalonBundle({
    ownerId: owner1.id,
    name: 'Luxe Lane Salon',
    slug: 'luxe-lane',
    customDomain: 'luxelane.example.com',
    logoUrl: null,
    capacity: 6,
    stripe: {
      stripeAccountId: '',
      stripeAccountStatus: '',
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeOnboardedAt: '',
      stripeRequirementsDue: [],
      platformFeePercent: 10,
      platformFeeMinCents: 50,
    },
  });

  // Second owner and salon
  const owner2 = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob.owner@example.com',
      emailVerified: true,
      image: null,
      twoFactorEnabled: false,
    },
  });

  const s2 = await createSalonBundle({
    ownerId: owner2.id,
    name: 'Harbour Cuts',
    slug: 'harbour-cuts',
    customDomain: null,
    logoUrl: null,
    capacity: 3,
    stripe: {
      stripeAccountId: '',
      stripeAccountStatus: '',
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeOnboardedAt: '',
      stripeRequirementsDue: [],
      platformFeePercent: 10,
      platformFeeMinCents: 50,
    },
  });

  // Third owner and salon
  const owner3 = await prisma.user.create({
    data: {
      name: 'Charlie Nguyen',
      email: 'charlie.owner@example.com',
      emailVerified: true,
      image: null,
      twoFactorEnabled: false,
    },
  });

  const s3 = await createSalonBundle({
    ownerId: owner3.id,
    name: 'Saigon Style Studio',
    slug: 'saigon-style',
    timeZone: 'Asia/Ho_Chi_Minh',
    customDomain: null,
    logoUrl: null,
    capacity: 4,
    stripe: {
      stripeAccountId: '',
      stripeAccountStatus: '',
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeOnboardedAt: '',
      stripeRequirementsDue: [],
      platformFeePercent: 10,
      platformFeeMinCents: 50,
    },
  });

  console.log('✅ Seed complete:', {
    owners: [
      { id: owner1.id, email: owner1.email, salon: s1.salon.slug },
      { id: owner2.id, email: owner2.email, salon: s2.salon.slug },
      { id: owner3.id, email: owner3.email, salon: s3.salon.slug },
    ],
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
