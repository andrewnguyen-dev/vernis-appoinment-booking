# Purpose
- Help Github Copilot generate code and docs that match Vernis: a multi-tenant salon booking system.
- MVP rules: no staff selection by customers, multi-service appointments, payments, categories.

# Business & Product
BUSINESS.name: "Vernis"
BUSINESS.type: "Multi-tenant SaaS for salons"
BUSINESS.region_default_tz: "Australia/Sydney"
BUSINESS.users:
  - "Salon owners" (manage catalog, clients, appointments, billing)
  - "Staff"
  - "Clients" (book multi-service appointments)
VALUE_PROP:
  - Simple online booking
  - Multi-service cart-like booking flow
  - Integrated payments
  - Ready for salons to onboard quickly

# Architecture & Stack
STACK.frontend: Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui
STACK.backend: Next.js Route Handlers + Server Actions
STACK.db: Vercel Postgres via Prisma
STACK.auth: BetterAuth (Prisma adapter)
STACK.email: Resend (React Email templates)
STACK.payments: Stripe (Checkout + Webhooks)
STACK.job/cron: Vercel Cron (HTTP-triggered later)
STACK.validation: Zod
STACK.dates: date-fns + date-fns-tz
STACK.logging: lightweight console (Sentry later)
STACK.testing: Vitest + Playwright (later)


# Code Generation rules
You are an expert in TypeScript, Node.js, Next.js App Router, React, Shadcn UI, Radix UI and Tailwind.

Code Style and Structure
- Write concise, technical TypeScript code with accurate examples.
- Use functional and declarative programming patterns; avoid classes.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
- Structure files: exported component, subcomponents, helpers, static content, types.

Naming Conventions
- Use lowercase with dashes for directories (e.g., components/auth-wizard).
- Favor named exports for components.

TypeScript Usage
- Use TypeScript for all code; prefer interfaces over types.
- Avoid enums; use maps instead.
- Use functional components with TypeScript interfaces.

Syntax and Formatting
- Use the "function" keyword for pure functions.
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements.
- Use declarative JSX.

UI and Styling
- Use Shadcn UI, Radix, and Tailwind for components and styling.
- Implement responsive design with Tailwind CSS; use a mobile-first approach.

Performance Optimization
- Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC).
- Wrap client components in Suspense with fallback.
- Use dynamic loading for non-critical components.
- Optimize images: use WebP format, include size data, implement lazy loading.

Key Conventions
- Use 'nuqs' for URL search parameter state management.
- Optimize Web Vitals (LCP, CLS, FID).
- Limit 'use client':
  - Favor server components and Next.js SSR.
  - Use only for Web API access in small components.
  - Avoid for data fetching or state management.

Follow Next.js docs for Data Fetching, Rendering, and Routing.

# Project Tree
├── actions
├── app
│   ├── (auth)
│   │   ├── forgot-password
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── owner-sign-in
│   │   │   └── page.tsx
│   │   ├── owner-sign-up
│   │   │   └── page.tsx
│   │   ├── reset-password
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx
│   │   ├── sign-in
│   │   │   └── page.tsx
│   │   └── sign-up
│   │       └── page.tsx
│   ├── (owner)
│   │   ├── appointments
│   │   │   ├── appointments-view.tsx
│   │   │   └── page.tsx
│   │   ├── catalog
│   │   │   └── page.tsx
│   │   ├── clients
│   │   │   └── page.tsx
│   │   ├── dashboard
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   └── staffs
│   ├── (public-booking)
│   │   └── [salonSlug]
│   │       └── book
│   │           ├── booking-form.tsx
│   │           ├── confirmation
│   │           │   └── page.tsx
│   │           └── page.tsx
│   ├── actions
│   │   ├── appointment-management.ts
│   │   ├── appointment.ts
│   │   └── catalog.ts
│   ├── api
│   │   ├── auth
│   │   │   ├── [...all]
│   │   │   │   └── route.ts
│   │   │   └── verify-owner
│   │   │       └── route.ts
│   │   └── salons
│   │       └── [salonSlug]
│   │           └── availability
│   │               └── route.ts
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── sidenav-example
│       └── page.tsx
├── betterauth-nextjs-docs.md
├── components
│   ├── app-sidebar.tsx
│   ├── appointments
│   │   ├── appointment-detail-modal.tsx
│   │   ├── appointment-list-view.tsx
│   │   ├── appointments-page-client.tsx
│   │   └── calendar-day-view.tsx
│   ├── auth
│   │   ├── forgot-password.tsx
│   │   ├── owner-sign-in.tsx
│   │   ├── owner-sign-up.tsx
│   │   ├── reset-password.tsx
│   │   ├── sign-in.tsx
│   │   ├── sign-out.tsx
│   │   └── sign-up.tsx
│   ├── availability-calendar.tsx
│   ├── calendar-20.tsx
│   ├── card-wrapper.tsx
│   ├── catalog
│   │   ├── catalog-manager.tsx
│   │   ├── catalog-table.tsx
│   │   ├── category-form.tsx
│   │   └── service-form.tsx
│   ├── emails
│   │   └── reset-password.tsx
│   ├── form-error.tsx
│   ├── form-success.tsx
│   ├── owner-sidebar.tsx
│   ├── search-form.tsx
│   ├── staff
│   ├── ui
│   │   ├── badge.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── button.tsx
│   │   ├── calendar.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── separator.tsx
│   │   ├── sheet.tsx
│   │   ├── sidebar.tsx
│   │   ├── skeleton.tsx
│   │   ├── switch.tsx
│   │   ├── table.tsx
│   │   ├── textarea.tsx
│   │   └── tooltip.tsx
│   └── version-switcher.tsx
├── components.json
├── db
│   └── index.ts
├── docs
│   ├── authentication.md
│   └── salon-capacity-implementation.md
├── eslint.config.mjs
├── examples
│   ├── capacity-booking-test.ts
│   └── reschedule-capacity-test.ts
├── helpers
│   └── zod
│       ├── catalog-schemas.ts
│       ├── forgot-password-schema.ts
│       ├── login-schema.ts
│       ├── reset-password-schema.ts
│       └── signup-schema.ts
├── hooks
│   ├── use-mobile.ts
│   └── useAuthState.ts
├── lib
│   ├── auth-client.ts
│   ├── auth-utils.ts
│   ├── auth.ts
│   ├── availability.ts
│   ├── salon-signup.ts
│   ├── tenancy.ts
│   ├── timezone.ts
│   ├── user-utils.ts
│   └── utils.ts
├── middleware.ts
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── prisma
│   ├── migrations
│   │   ├── 20250909103341_auth
│   │   │   └── migration.sql
│   │   ├── 20250910061931_add_new_tables
│   │   │   └── migration.sql
│   │   ├── 20250910065958_rename_tables_to_snake_case
│   │   │   └── migration.sql
│   │   ├── 20250912074043_add_salon_availability_tables
│   │   │   └── migration.sql
│   │   ├── 20250914033200_enforce_one_user_one_salon
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   ├── schema.prisma
│   └── seed.ts
├── public
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── README.md
├── tsconfig.json
├── tsconfig.tsbuildinfo
└── types
    └── appointment.ts