# Stripe Connect Integration Plan for Vernis Salon Booking System

Based on your demo implementation and existing infrastructure, here's a comprehensive plan to integrate Stripe Connect into your production Vernis application:

---

## **Phase 1: Database Schema Updates**

### **1.1 Add Stripe Connect Fields to Salon Model**
Update [`prisma/schema.prisma`](prisma/schema.prisma ):

```prisma
model Salon {
  // ...existing fields...

  // Stripe Connect integration
  stripeAccountId        String?  @unique  // Connected account ID (acct_...)
  stripeAccountStatus    String?            // onboarding status tracking
  stripeChargesEnabled   Boolean  @default(false)
  stripePayoutsEnabled   Boolean  @default(false)
  stripeOnboardedAt      DateTime?
  stripeRequirementsDue  String[] @default([]) // JSON array of missing requirements

  // Application fee configuration (platform revenue)
  platformFeePercent     Int      @default(10) // 10% default
  platformFeeMinCents    Int      @default(50) // $0.50 minimum
}
```

### **1.2 Update Payment Model**
Enhance the existing [`Payment`](prisma/schema.prisma ) model:

```prisma
model Payment {
  // ...existing fields...

  // Stripe-specific fields
  stripeSessionId        String?  @unique  // Checkout Session ID
  stripePaymentIntentId  String?  @unique  // Payment Intent ID
  stripeChargeId         String?           // Charge ID for refunds
  stripeFeeAmount        Int?              // Stripe's fee (in cents)
  platformFeeAmount      Int?              // Platform's application fee (in cents)
  netAmount              Int?              // Amount salon receives (in cents)
  stripeRefundId         String?           // If refunded

  // Link to connected account
  connectedAccountId     String?           // The salon's Stripe account
}
```

---

## **Phase 2: Stripe Connect Service Layer**

### **2.1 Create Connected Account Management Service**
New file: `lib/services/stripe-connect-service.ts`

**Responsibilities:**
- Create connected accounts during salon owner onboarding
- Generate onboarding links for KYC/compliance
- Check account status and requirements
- Handle account updates via webhooks
- Retrieve account balance and payout information

**Key Functions:**
```typescript
- createConnectedAccountForSalon(salonId, email, businessUrl?)
- generateOnboardingLink(salonId, refreshUrl, returnUrl)
- syncAccountStatus(salonId) // Pull latest from Stripe
- isAccountReadyForPayments(salonId)
- getAccountRequirements(salonId)
```

### **2.2 Create Payment Service**
New file: `lib/services/stripe-payment-service.ts`

**Responsibilities:**
- Create Checkout Sessions for appointment bookings
- Calculate application fees (platform revenue)
- Handle payment confirmations
- Process refunds through connected accounts
- Sync products/services with Stripe (optional)

**Key Functions:**
```typescript
- createAppointmentCheckoutSession(appointmentId, salonSlug)
- handleSuccessfulPayment(sessionId)
- refundAppointment(appointmentId, reason)
- calculatePlatformFee(amountCents, salonConfig)
```

---

## **Phase 3: Owner Onboarding Integration**

### **3.1 Extend Owner Onboarding Flow**
Modify [`app/(owner)/onboarding/page.tsx`](app/(owner)/onboarding/page.tsx ) and [`components/onboarding/owner-onboarding-form.tsx`](components/onboarding/owner-onboarding-form.tsx ):

**Steps:**
1. **Existing salon setup** (name, hours, capacity) → stays as is
2. **NEW: Stripe Connect Onboarding**
   - Automatically create connected account when salon is created
   - Provide "Complete payment setup" button
   - Show onboarding status (requirements due, charges enabled, etc.)
3. Mark onboarding complete only when Stripe account is ready

### **3.2 Update Onboarding Action**
Extend [`app/actions/owner-onboarding.ts`](app/actions/owner-onboarding.ts ):

```typescript
export async function completeOwnerOnboarding(data: OwnerOnboardingInput) {
  // ...existing salon creation...

  // Create Stripe Connected Account
  const stripeAccount = await createConnectedAccountForSalon(
    salon.id,
    session.user.email,
    data.customDomain
  );

  // Update salon with Stripe account ID
  await prisma.salon.update({
    where: { id: salon.id },
    data: { stripeAccountId: stripeAccount.id }
  });

  // Return onboarding link
  return {
    success: true,
    requiresStripeOnboarding: true,
    stripeOnboardingUrl: await generateOnboardingLink(salon.id, ...)
  };
}
```

### **3.3 Add Post-Onboarding Status Check**
Create `app/(owner)/onboarding/payment-setup/page.tsx`:

- Show Stripe account status
- Display pending requirements
- "Complete payment setup" CTA that opens Account Link
- Progress indicator (e.g., "2 of 3 requirements completed")

---

## **Phase 4: Settings Integration**

### **4.1 Add Stripe Connect Section to Settings**
Update [`app/(owner)/settings/page.tsx`](app/(owner)/settings/page.tsx ):

**New Settings Card: "Payment & Payouts"**
- Display: Connected account status
- Show: Charges enabled, payouts enabled
- Action: "Update payment information" → opens Account Link
- Info: View recent payouts, balance, upcoming transfers
- Link: "View Stripe Dashboard" → opens Express Dashboard

### **4.2 Create Stripe Settings Component**
New file: `components/salon/stripe-settings.tsx`

**Features:**
- Account status badges (Active, Pending, Action Required)
- Requirements list with resolution links
- Payout schedule display
- Re-onboard button if requirements exist
- Link to Stripe Express Dashboard

---

## **Phase 5: Booking Flow Payment Integration**

### **5.1 Update Booking Confirmation Step**
Modify [`app/(public-booking)/[salonSlug]/book/booking-form.tsx`](app/(public-booking)/[salonSlug]/book/booking-form.tsx):

**Change "Book Appointment" button behavior:**
- Instead of directly creating appointment → Create Stripe Checkout Session
- Redirect to Stripe Checkout
- On success → create appointment and redirect to confirmation

### **5.2 Update Appointment Creation Action**
Modify [`app/actions/appointment.ts`](app/actions/appointment.ts ):

**Current flow:**
```typescript
handleSubmit() → createAppointment() → confirmation page
```

**New flow:**
```typescript
handleSubmit() → createCheckoutSession() → redirect to Stripe
// User pays on Stripe
Stripe redirects → handleCheckoutSuccess() → createAppointment() → confirmation
```

### **5.3 Create Checkout Session Action**
New server action: `app/actions/stripe-checkout.ts`

```typescript
export async function createBookingCheckoutSession(
  salonSlug: string,
  bookingData: BookingFormData
) {
  const salon = await getSalonBySlug(salonSlug);

  // Ensure salon has Stripe account
  if (!salon.stripeAccountId || !salon.stripeChargesEnabled) {
    return { error: "This salon hasn't set up payments yet" };
  }

  const stripe = getStripeServerClient();

  // Calculate application fee
  const platformFee = calculatePlatformFee(
    bookingData.totalPrice,
    salon.platformFeePercent,
    salon.platformFeeMinCents
  );

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: bookingData.services.map(service => ({
        price_data: {
          currency: 'aud',
          product_data: { name: service.name },
          unit_amount: service.priceCents,
        },
        quantity: 1,
      })),
      payment_intent_data: {
        application_fee_amount: platformFee,
      },
      success_url: `${baseUrl}/${salonSlug}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${salonSlug}/book?cancelled=true`,
      metadata: {
        salonId: salon.id,
        bookingData: JSON.stringify(bookingData),
      },
    },
    {
      stripeAccount: salon.stripeAccountId, // Connected account
    }
  );

  return { sessionUrl: session.url };
}
```

### **5.4 Create Success Handler**
New page: [`app/(auth)/owner-sign-up/page.tsx`](app/(auth)/owner-sign-up/page.tsx )

**Flow:**
1. Retrieve Checkout Session from Stripe
2. Verify payment status
3. Extract booking data from metadata
4. Create appointment record
5. Create payment record
6. Redirect to confirmation page

---

## **Phase 6: Webhook Integration**

### **6.1 Create Webhook Endpoint**
New file: `app/api/webhooks/stripe/route.ts`

**Events to handle:**
- [`checkout.session.completed`](node_modules/stripe/types/index.d.ts ) → Confirm payment, create appointment
- [`account.updated`](app/actions/stripe-connect-demo.ts ) → Sync salon's Stripe account status
- `payment_intent.succeeded` → Record successful payment
- `charge.refunded` → Update payment and appointment status
- [`account.application.deauthorized`](app/connect-demo/page.tsx ) → Handle account disconnection

### **6.2 Webhook Handler Service**
New file: `lib/services/stripe-webhook-handler.ts`

```typescript
export async function handleCheckoutSessionCompleted(session) {
  // Extract booking data from metadata
  // Create appointment
  // Create payment record
  // Send confirmation email
}

export async function handleAccountUpdated(account) {
  // Find salon by stripeAccountId
  // Update account status fields
  // Notify owner if action required
}

export async function handleChargeRefunded(charge) {
  // Find payment by stripeChargeId
  // Update payment status to REFUNDED
  // Update appointment status to CANCELED
  // Send refund notification
}
```

---

## **Phase 7: Dashboard & Reporting**

### **7.1 Add Payments Tab to Owner Dashboard**
Update [`app/(owner)/dashboard/page.tsx`](app/(owner)/dashboard/page.tsx ):

**New metrics:**
- Today's revenue
- Pending payouts
- Upcoming transfers
- Payment success rate

### **7.2 Create Payments Management Page**
New page: [`app/(auth)/owner-sign-up/page.tsx`](app/(auth)/owner-sign-up/page.tsx )

**Features:**
- List all payments with filters (date, status, amount)
- Search by client name or appointment ID
- Refund functionality
- Export to CSV
- Integration with appointment details

### **7.3 Update Appointment Management**
Enhance [`components/appointments/appointment-detail-modal.tsx`](components/appointments/appointment-detail-modal.tsx ):

**Add payment information:**
- Payment status badge
- Amount paid
- Platform fee
- Net amount to salon
- Stripe dashboard link
- Refund button (if applicable)

---

## **Phase 8: Product/Service Sync (Optional)**

### **8.1 Sync Services to Stripe Products**
Extend [`app/actions/catalog.ts`](app/actions/catalog.ts ):

**When creating/updating services:**
- Create corresponding Stripe Product
- Create default Price
- Store `stripeProductId` and `stripePriceId` in Service model
- Use these IDs in Checkout Sessions (cleaner than dynamic prices)

**Schema addition:**
```prisma
model Service {
  // ...existing fields...
  stripeProductId String? @unique
  stripePriceId   String? @unique
}
```

**Benefits:**
- Better reporting in Stripe Dashboard
- Easier reconciliation
- Product catalog visible in Stripe

---

## **Phase 9: Testing & Migration Strategy**

### **9.1 Feature Flag Approach**
Add environment variable: `STRIPE_CONNECT_ENABLED=false`

- Initially deploy with payments disabled
- Test onboarding flow in staging
- Enable for select salons (beta test)
- Gradual rollout to all salons

### **9.2 Migration Plan for Existing Salons**
Create admin script: `scripts/migrate-salons-to-stripe.ts`

**For each existing salon:**
1. Create connected account
2. Generate onboarding link
3. Send email to owner
4. Track completion status
5. Enable payments only when ready

### **9.3 Test Scenarios**
- [ ] New salon onboarding with Stripe
- [ ] Existing salon adding Stripe
- [ ] Complete booking flow with payment
- [ ] Failed payment handling
- [ ] Refund processing
- [ ] Webhook delivery and replay
- [ ] Account disconnection
- [ ] Multiple currency support (if needed)

---

## **Phase 10: Error Handling & Edge Cases**

### **10.1 Handle Stripe Unavailability**
- Graceful degradation if Stripe is down
- Queue webhook processing with retries
- Display appropriate error messages

### **10.2 Partial Onboarding**
- Allow salons to use system before completing Stripe setup
- Disable payment collection but allow appointment booking
- Show prominent banner: "Complete payment setup to accept online payments"

### **10.3 Account Restrictions**
- Handle accounts under review
- Notify owners of issues
- Provide support contact information

---

## **Key Differences from Demo Implementation**

| **Demo** | **Production** |
|----------|---------------|
| Stateless (reads from Stripe every time) | Cache account status in database |
| Raw `acct_` IDs in URLs | Use salon slugs, resolve account server-side |
| Manual account ID entry | Automatic account creation during onboarding |
| Single storefront | Multi-tenant with isolated accounts |
| No webhook handling | Full webhook integration |
| Demo UI components | Production shadcn/ui components |
| Products created manually | Services synced automatically |
| No authentication | Integrated with BetterAuth |

---

## **Implementation Order (Recommended)**

1. **Week 1:** Database schema + Stripe service layer
2. **Week 2:** Owner onboarding integration + settings page
3. **Week 3:** Booking flow payment integration
4. **Week 4:** Webhook handlers + success/failure flows
5. **Week 5:** Dashboard reporting + payment management
6. **Week 6:** Testing + migration script + documentation
7. **Week 7:** Beta rollout + monitoring + bug fixes

---

## **Critical Considerations**

### **Security:**
- Validate all webhook signatures
- Never expose connected account IDs to clients
- Sanitize metadata before storing
- Implement rate limiting on checkout creation

### **Compliance:**
- Ensure terms of service mention platform fees
- Display fees clearly during checkout
- Provide receipts via email
- Store transaction records for 7 years (AU requirement)

### **UX:**
- Show loading states during Stripe redirects
- Handle payment failures gracefully
- Provide clear error messages
- Send confirmation emails immediately

### **Monitoring:**
- Track payment success rates
- Monitor webhook delivery
- Alert on failed payments
- Dashboard for platform revenue

---

This plan integrates Stripe Connect seamlessly into your existing Vernis infrastructure while maintaining the multi-tenant architecture and MVP simplicity. The phased approach allows you to test incrementally and roll back if issues arise.