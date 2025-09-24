## **Stripe Integration Roadmap**

### **Phase 1: Foundation Setup (Week 1)**

#### **1.1 Stripe Connect Integration**
- Set up Stripe Connect accounts for salon onboarding
- Create OAuth flow for salons to connect their Stripe accounts
- Store Stripe account IDs securely in salon records
- Add Stripe Connect status to salon onboarding checklist

#### **1.2 Database Schema Updates**
- Add deposit configuration fields to Salon model:
  - `stripeAccountId` (Connect account)
  - `depositType` (PERCENTAGE | FIXED_AMOUNT | AUTHORIZATION_ONLY)
  - `depositValue` (percentage or cents)
  - `depositDescription`
  - `requireDeposit` (boolean)
- Update Payment model to track deposit vs full payment amounts
- Add payment intent reference fields

#### **1.3 Environment & Dependencies**
- Verify Stripe SDK integration
- Set up webhook endpoints infrastructure
- Configure Stripe API versions and error handling

### **Phase 2: Salon Configuration (Week 2)**

#### **2.1 Owner Settings Interface**
- Add Stripe Connect setup to salon onboarding flow
- Create deposit configuration section in salon settings
- Build UI for managing payment preferences
- Add validation for deposit configuration rules

#### **2.2 Connect Account Management**
- Implement Stripe Connect OAuth callback handling
- Add account status indicators in owner dashboard
- Create disconnect/reconnect functionality
- Handle account verification requirements

### **Phase 3: Payment Flow Integration (Week 3-4)**

#### **3.1 Booking Flow Modifications**
- Restructure booking form to add payment step before customer details
- Calculate deposit amounts based on salon configuration
- Add payment summary display with clear deposit vs total breakdown
- Implement payment step UI with Stripe Elements or Checkout

#### **3.2 Payment Processing**
- Create `createPaymentIntent()` server action
- Implement payment verification before appointment creation
- Add payment failure handling and user feedback
- Ensure appointment creation is atomic with payment success

#### **3.3 Stripe Checkout Integration**
- Configure Checkout sessions with salon-specific settings
- Handle success/cancel redirect flows
- Implement customer payment method collection
- Add loading states and error boundaries

### **Phase 4: Webhooks & Payment Management (Week 5)**

#### **4.1 Webhook Infrastructure**
- Set up Stripe webhook endpoint (`/api/webhooks/stripe`)
- Implement webhook signature verification
- Handle key payment events:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.dispute.created`

#### **4.2 Payment Status Tracking**
- Update appointment status based on payment events
- Implement payment status sync across system
- Add payment retry mechanisms for failed attempts
- Handle partial payments and authorization holds

### **Phase 5: Refunds & Financial Management (Week 6)**

#### **5.1 Refund System**
- Build automated refund capability for cancellations
- Create refund policies configuration per salon
- Implement manual refund processing for owners
- Add refund status tracking and notifications

#### **5.2 Receipt & Invoice Generation**
- Create receipt templates for deposits and full payments
- Implement automatic receipt email delivery
- Add invoice generation for completed appointments
- Build payment history views for owners and clients

### **Phase 6: Advanced Features (Week 7-8)**

#### **6.1 Payment Analytics**
- Add payment metrics to owner dashboard
- Create revenue tracking and reporting
- Implement failed payment analytics
- Add deposit vs full payment conversion tracking

#### **6.2 Enhanced User Experience**
- Add payment method saving for repeat customers
- Implement payment reminders for outstanding balances
- Create payment status indicators in appointment views
- Add bulk payment processing capabilities

#### **6.3 Error Handling & Recovery**
- Build comprehensive payment error handling
- Add payment retry workflows
- Implement payment reconciliation tools
- Create payment dispute management interface

### **Phase 7: Testing & Launch Preparation (Week 9)**

#### **7.1 Testing Suite**
- Create comprehensive payment flow tests
- Test webhook reliability and error scenarios
- Validate refund processes and edge cases
- Perform load testing on payment infrastructure

#### **7.2 Documentation & Support**
- Create salon owner payment setup guides
- Document payment troubleshooting procedures
- Build customer payment FAQ sections
- Create payment policy templates

### **Phase 8: Soft Launch & Monitoring (Week 10)**

#### **8.1 Gradual Rollout**
- Enable payments for select test salons
- Monitor payment success rates and failures
- Collect feedback on user experience
- Fine-tune payment flow based on real usage

#### **8.2 Production Monitoring**
- Set up payment monitoring dashboards
- Implement payment failure alerts
- Create automated health checks
- Establish support procedures for payment issues

### **Key Integration Points with Existing System:**

1. **Appointment Creation Flow**: Payment verification becomes prerequisite
2. **Salon Settings**: Deposit configuration integrated into existing settings
3. **Owner Dashboard**: Payment metrics added to existing KPIs
4. **Booking Confirmation**: Payment receipt information included
5. **Staff Management**: No direct impact, but payment status visible in appointment details