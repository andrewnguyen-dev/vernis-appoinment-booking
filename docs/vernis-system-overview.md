# Vernis Appointment Booking – System Overview

## Business & Product Context
- Vernis is a multi-tenant salon booking platform that differentiates between salon owners, staff, and public customers through role-based access and rich staff management so appointments can be color-coded and assigned without duplicating user data.
- Onboarding new salons currently involves a concierge workflow: administrators pre-create the user, salon, and membership records, then guide the owner through password setup and configuration so their booking link can go live.
- The landing page offers quick entry points for owners, customers, and public booking, reinforcing the dual-sided nature of the product.

## Architecture and Code Organization

### Application layout
- The Next.js app uses route groups for authentication, owner dashboards, and public booking. Owners receive a sidebar-driven layout with navigation to dashboard, appointments, catalog, clients, staff, and settings, all wrapped in a collapsible shell that surfaces breadcrumbs.
- Public booking routes resolve salon slugs, fetch available services, and render client-side flows, keeping owner and guest experiences isolated.

### Server actions and services
- Domain-specific server actions live under `app/actions/`, covering appointment creation and management, catalog CRUD, staff operations, and salon settings. These actions enforce ownership checks, validation, and cache revalidation for their respective routes.
- Shared libraries provide authentication helpers, tenancy lookups, capacity-aware availability, staff utilities, and form schemas, centralizing cross-cutting concerns.

### Data model
- Prisma models capture the multi-tenant salon hierarchy (Salon, Membership, Staff), catalog (ServiceCategory, Service), clients, appointments with line items, payments, and availability (BusinessHours, SalonClosure). Uniqueness constraints and relations enforce tenant isolation and role semantics.

### Infrastructure & auth
- Better Auth with a Prisma adapter and Resend handles email/password login, password resets, and secure session cookies, while lightweight middleware guards owner routes before deeper server-side checks run.

## Core Workflows

### Authentication & Access Control
- Auth pages automatically redirect logged-in users to owner or customer destinations, and server utilities (`requireAuth`, `requireOwnerAuth`) enforce role checks and onboarding completion before allowing access to protected routes.

### Salon Owner Experience
- **Onboarding & settings:** Owners complete a guided setup form that captures branding, booking URL, time zone, capacity, and business hours. Defaults are derived from existing records, validated with Zod, persisted via a transaction, and revalidated across dependent pages.
- **Catalog management:** The catalog dashboard loads categories/services via a server action, surfaces KPIs, and exposes dialogs to add or edit entries. Back-end actions validate uniqueness, ensure services belong to the salon, and support reordering, deletion safeguards, and active flags.
- **Staff management:** Owners view active/inactive staff with color indicators, add existing user accounts as staff, tweak phone/status/color, and remove non-owner members. Server actions verify salon ownership, generate colors, and update both membership and staff records atomically.
- **Appointment operations:** The appointments page fetches upcoming bookings (including client, staff, and service details), offers calendar and list views, and opens a modal for editing. Owners can update status, client contact, staff assignment, notes, reschedule with capacity validation, or cancel appointments, with server actions enforcing salon ownership and revalidating caches.
- **Dashboard:** A summary screen greets owners with snapshot metrics and sample widgets for upcoming appointments and revenue, acting as an entry point to deeper management tools.

### Public Booking Journey
- Guests reach a branded booking page that loads salon metadata and active services. A three-step client-side form guides users through selecting services, choosing available slots via a capacity-aware calendar, and entering contact details, while server actions validate pricing, manage clients, and create appointments with transactional integrity.
- Availability checks rely on a sweep-line algorithm that considers business hours, closures, overlapping appointments, and salon capacity. Both the API and calendar component expose capacity metadata to provide transparent feedback when slots fill up.
- After booking, customers see a confirmation page that renders appointment details, salon name, localized date/time, service summary, and follow-up guidance, with navigation back to booking or the salon page.

### Staff & Client Ecosystem
- Staff management integrates with the appointment system, ensuring colors and active status drive assignment visibility while preserving owner roles, and clients are deduplicated or updated during bookings to maintain clean CRM data.

## Supporting Services & Utilities
- Utility modules provide tenancy lookups, timezone formatting, business-hour defaults, and reusable constants that keep UI components consistent and timezone-aware.
- Better Auth integrations send password reset emails via React Email + Resend, and middleware offers optimistic redirects before server-side checks, balancing UX and security.
