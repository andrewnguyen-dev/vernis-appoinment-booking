import type { PaymentProvider, PaymentStatus } from '@prisma/client'

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELED' | 'COMPLETED'

export interface AppointmentPaymentData {
  id: string
  status: PaymentStatus
  provider: PaymentProvider
  amountCents: number
  currency: string
  platformFeeAmount: number | null
  netAmount: number | null
  stripeFeeAmount: number | null
  stripePaymentIntentId?: string | null
  stripeChargeId?: string | null
  stripeRefundId?: string | null
  connectedAccountId?: string | null
  providerRef?: string | null
  capturedAt?: Date | null
  refundedAt?: Date | null
}

export interface AppointmentData {
  id: string
  startsAt: Date
  endsAt: Date
  startsAtLocal: Date
  endsAtLocal: Date
  status: AppointmentStatus
  notes?: string | null
  client: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    phone: string | null
  }
  assignedStaff?: {
    id: string
    userId: string
    color: string
    user: {
      name: string
    }
  } | null
  items: Array<{
    id: string
    serviceName: string
    priceCents: number
    durationMinutes: number
    sortOrder: number
    service?: {
      id: string
      name: string
      description?: string | null
      category?: {
        name: string
      } | null
    } | null
  }>
  createdBy?: {
    id: string
    name: string
    email: string
  } | null
  payment?: AppointmentPaymentData | null
}

export interface AppointmentUpdateData {
  status: AppointmentStatus
  notes: string
  assignedStaffId?: string | null
  client: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
}
